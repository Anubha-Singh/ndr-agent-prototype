from http.server import BaseHTTPRequestHandler
import json
import os
import requests

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            payload = json.loads(post_data.decode('utf-8'))

            awb = payload.get("awb", "UNKNOWN")
            customer_reply = payload.get("customer_reply", "")
            api_key = os.environ.get("GEMINI_API_KEY")

            parsed_data = {}

            if api_key and customer_reply:
                try:
                    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
                    headers = {"Content-Type": "application/json"}
                    
                    # Force Gemini to act as a structured data parser
                    prompt_text = (
                        f"You are a logistics NLP parser. A customer replied to a missed delivery text. "
                        f"Customer Reply: '{customer_reply}'\n"
                        f"Extract the intent. Return ONLY a valid JSON object with these exact keys: "
                        f"'intent' (must be Reschedule, Return_To_Origin, or Alternate_Instruction), "
                        f"'new_date' (extract day/date if mentioned, else null), "
                        f"'special_instructions' (extract any specific delivery directions, else null)."
                    )
                    
                    body = {
                        "contents": [{"parts": [{"text": prompt_text}]}],
                        "generationConfig": {"response_mime_type": "application/json"} # Enforces JSON output
                    }
                    
                    response = requests.post(url, json=body, headers=headers, timeout=5)
                    if response.status_code == 200:
                        res_json = response.json()
                        raw_ai_text = res_json['candidates'][0]['content']['parts'][0]['text'].strip()
                        parsed_data = json.loads(raw_ai_text)
                except Exception as api_err:
                    parsed_data = {"error": "Failed to parse via API"}

            # Fallback if parsing fails
            if not parsed_data:
                parsed_data = {
                    "intent": "Alternate_Instruction",
                    "new_date": "Friday",
                    "special_instructions": "leave it with the guard"
                }

            # Response simulating a database update
            response_data = {
                "status": "success",
                "message": "Customer reply parsed and mock DB updated",
                "awb": awb,
                "parsed_intelligence": parsed_data,
                "new_queue_status": "Re-attempt Scheduled 🟢"
            }

            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(response_data).encode('utf-8'))

        except Exception as e:
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"status": "error", "message": str(e)}).encode('utf-8'))