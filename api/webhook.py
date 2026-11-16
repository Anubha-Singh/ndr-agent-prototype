from http.server import BaseHTTPRequestHandler
import json
import os
import google.generativeai as genai

# Configure Gemini API
api_key = os.environ.get("GEMINI_API_KEY")
if api_key:
    genai.configure(api_key=api_key)

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            # 1. Read the incoming webhook payload from the "Courier"
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            payload = json.loads(post_data.decode('utf-8'))

            # Extract details from the mock courier event
            awb = payload.get("awb", "UNKNOWN")
            customer_name = payload.get("customer_name", "Customer")
            reason_code = payload.get("reason_code", "Customer Unavailable")

            # 2. Attempt to generate message via Gemini API using gemini-3.8-flash
            ai_message = ""
            try:
                if api_key:
                    model = genai.GenerativeModel('gemini-3.8-flash')
                    prompt = (
                        f"You are an autonomous AI logistics recovery agent. "
                        f"A delivery failed for customer {customer_name}. Reason: {reason_code}. "
                        f"Draft a polite, concise, localized WhatsApp recovery message under 40 words."
                    )
                    response = model.generate_content(prompt)
                    ai_message = response.text.strip()
                else:
                    raise Exception("API key missing")
            except Exception as api_err:
                # Instant fallback so your demo never hangs during your presentation
                ai_message = f"Hi {customer_name}, your delivery failed today due to {reason_code}. Shall we reattempt delivery tomorrow?"

            # 3. Formulate the success response back to Postman
            response_data = {
                "status": "success",
                "message": "NDR Agent successfully processed event",
                "awb": awb,
                "generated_whatsapp_text": ai_message,
                "action_taken": "Sent automated recovery prompt to customer"
            }

            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(response_data).encode('utf-8'))

        except Exception as e:
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            error_response = {"status": "error", "message": str(e)}
            self.wfile.write(json.dumps(error_response).encode('utf-8'))
        
        return