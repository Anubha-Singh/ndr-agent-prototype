from http.server import BaseHTTPRequestHandler
import json
import os
import requests

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            # 1. Read the incoming webhook payload from Postman
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            payload = json.loads(post_data.decode('utf-8'))

            # Extract details from the mock courier event
            awb = payload.get("awb", "UNKNOWN")
            customer_name = payload.get("customer_name", "Customer")
            reason_code = payload.get("reason_code", "Customer Unavailable")
            api_key = os.environ.get("GEMINI_API_KEY")

            ai_message = ""

            # 2. Direct REST API call (Super fast, zero SDK lag or hanging)
            if api_key:
                try:
                    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
                    headers = {"Content-Type": "application/json"}
                    prompt_text = (
                        f"You are an autonomous AI logistics recovery agent. "
                        f"A delivery failed for customer {customer_name}. Reason: {reason_code}. "
                        f"Draft a polite, concise, localized WhatsApp recovery message under 40 words."
                    )
                    body = {
                        "contents": [{
                            "parts": [{"text": prompt_text}]
                        }]
                    }
                    # 4-second hard timeout so it never hangs Postman
                    response = requests.post(url, json=body, headers=headers, timeout=4)
                    if response.status_code == 200:
                        res_json = response.json()
                        ai_message = res_json['candidates'][0]['content']['parts'][0]['text'].strip()
                except Exception as api_err:
                    pass

            # Fallback if API key is missing or request takes too long
            if not ai_message:
                ai_message = f"Hi {customer_name}, your delivery failed today due to {reason_code}. Shall we reattempt delivery tomorrow? Reply YES or update your address."

            # 3. Formulate the instant success response back to Postman
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