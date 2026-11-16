from http.server import BaseHTTPRequestHandler
import json
import os
import google.generativeai as genai

# Configure Gemini API (make sure to set your GEMINI_API_KEY in Vercel Environment Variables later)
# For local testing, you can temporarily paste your key or rely on env variables

genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))
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
            customer_phone = payload.get("customer_phone", "")

            # 2. Construct Prompt for Gemini Agent to generate a localized WhatsApp message
            prompt = f"""
            You are an autonomous AI logistics recovery agent for an e-commerce brand.
            A delivery failed for customer {customer_name}. 
            Failure Reason: {reason_code}.
            
            Draft a polite, concise, localized WhatsApp message to the customer asking if they want to reattempt delivery tomorrow or change their delivery instructions. Keep it professional and under 40 words.
            """

            # Call Gemini model
            model = genai.GenerativeModel('gemini-1.5-flash')
            response = model.generate_content(prompt)
            ai_message = response.text.strip()

            # 3. Formulate the success response back to the trigger source
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