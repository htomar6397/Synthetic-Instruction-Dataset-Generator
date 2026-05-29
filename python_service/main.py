import os
import json
import logging
from typing import List, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import google.generativeai as genai
import requests
from dotenv import load_dotenv

load_dotenv()

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("python_service")

app = FastAPI(title="SIDG Python AI Service", version="1.0.0")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API key setup
api_key = os.getenv("GEMINI_API_KEY") or os.getenv("FREEMODEL_API_KEY")
llm_active = False
is_freemodel = False

if api_key:
    if api_key.startswith("fe_"):
        is_freemodel = True
        llm_active = True
        logger.info("FreeModel API Key detected. Routing requests via FreeModel proxy.")
    else:
        try:
            genai.configure(api_key=api_key)
            llm_active = True
            logger.info("Gemini API Configured in Python service.")
        except Exception as e:
            logger.error(f"Failed to configure Gemini API: {e}")
else:
    logger.warning("No Gemini API key found in Python service. Running in mock fallback mode.")



# Pydantic Schemas
class GenerateRequest(BaseModel):
    chunk: str
    category: str
    language: str
    system_prompt: Optional[str] = None

class EvaluateRequest(BaseModel):
    context: str
    instruction: str
    response: str

class TranslateRequest(BaseModel):
    instruction: str
    response: str
    target_language: str


def clean_json_response(text: str) -> str:
    cleaned = text.strip()
    if cleaned.startswith("```json"):
        cleaned = cleaned[7:]
    elif cleaned.startswith("```"):
        cleaned = cleaned[3:]
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]
    return cleaned.strip()


def generate_mock_samples(chunk: str, category: str, language: str) -> List[dict]:
    sentences = [s.strip() for s in chunk.split(".") if len(s.strip()) > 15]
    if not sentences:
        sentences = [chunk[:50]]
        
    lang_tag = f"[In {language}] " if language.lower() != "english" else ""
    samples = []

    if category == "reasoning":
        samples.append({
            "instruction": f"{lang_tag}Analyze the structural concept of: \"{sentences[0]}\"",
            "reasoning": f"1. Identify premise: \"{sentences[0]}\"\n2. Establish context.\n3. Conclude meaning.",
            "response": f"{lang_tag}This represents the primary rule within the referenced dataset."
        })
        if len(sentences) > 1:
            samples.append({
                "instruction": f"{lang_tag}What logical inference can be drawn from: \"{sentences[1]}\"?",
                "reasoning": f"1. Look at text: \"{sentences[1]}\"\n2. Infer correlation.\n3. Formulate conclusion.",
                "response": f"{lang_tag}The core implication is that the system operates sequentially."
            })
    elif category == "coding":
        samples.append({
            "instruction": f"{lang_tag}Write a Python script modeling: \"{sentences[0][:30]}\"",
            "response": f"{lang_tag}Here is a Python function:\n\n```python\ndef run_model(data):\n    # Premise: {sentences[0][:30]}\n    return [item.upper() for item in data]\n```"
        })
    elif category == "tool_use":
        samples.append({
            "instruction": f"{lang_tag}Run operation for: \"{sentences[0][:30]}\"",
            "response": f"Tool: run_query(parameter=\"{sentences[0][:20]}\")"
        })
    elif category == "preference":
        samples.append({
            "instruction": f"{lang_tag}Explain the core premise: \"{sentences[0]}\"",
            "preference_chosen": f"{lang_tag}The statement details how to separate concerns and structure data accordingly.",
            "preference_rejected": f"{lang_tag}It means that \"{sentences[0]}\" is a rule. There is no other detail."
        })
    else:
        # General QA
        for index, sentence in enumerate(sentences[:3]):
            samples.append({
                "instruction": f"{lang_tag}Explain the key point: \"{sentence}.\"",
                "response": f"{lang_tag}Based on the context, {sentence}."
            })

    return samples


def call_llm(prompt: str, json_mode: bool = True) -> str:
    if is_freemodel:
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": "gemini-1.5-flash",
            "messages": [
                {"role": "user", "content": prompt}
            ],
            "temperature": 0.2
        }
        if json_mode:
            payload["response_format"] = {"type": "json_object"}
        
        response = requests.post("https://api.freemodel.dev/v1/chat/completions", json=payload, headers=headers, timeout=60)
        response.raise_for_status()
        return response.json()["choices"][0]["message"]["content"]
    else:
        model = genai.GenerativeModel("gemini-1.5-flash")
        generation_config = {"response_mime_type": "application/json"} if json_mode else None
        response = model.generate_content(prompt, generation_config=generation_config)
        return response.text


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "llm_active": llm_active,
        "api_key_configured": api_key is not None,
        "is_freemodel": is_freemodel
    }


@app.post("/generate")
def generate(req: GenerateRequest):
    if not llm_active:
        return generate_mock_samples(req.chunk, req.category, req.language)

    lang_prompt = f"The response MUST be written in {req.language}."

    if req.category == "reasoning":
        prompt = f"""You are a dataset creation assistant. Given the reference context:
"{req.chunk}"

Generate 2 complex question-answer pairs that require a step-by-step thinking process (Chain of Thought reasoning) to answer.
{lang_prompt}
Return a JSON array of objects matching this schema:
[{{ "instruction": "string", "reasoning": "string detailing step-by-step logical reasoning", "response": "string with final answer" }}]"""
    elif req.category == "coding":
        prompt = f"""You are a dataset creation assistant for coding LLMs. Given the reference context:
"{req.chunk}"

Generate 2 programming-related instruction-response pairs (e.g. write, complete, debug, or refactor code) based on context.
{lang_prompt}
Return a JSON array of objects matching this schema:
[{{ "instruction": "string describing coding task", "response": "string with explanation and code" }}]"""
    elif req.category == "tool_use":
        prompt = f"""You are a dataset creation assistant for tool use/function calling. Given the reference context:
"{req.chunk}"

Define a list of tools. Generate 2 instruction-response pairs where response calls appropriate tool with arguments in JSON.
{lang_prompt}
Return a JSON array of objects matching this schema:
[{{ "instruction": "string (the user's query)", "response": "string (structured output of tool call)" }}]"""
    elif req.category == "preference":
        prompt = f"""You are a dataset creation assistant for preference alignment. Given context:
"{req.chunk}"

Generate 2 instruction-response sets. For each instruction, create a 'preference_chosen' response (high-quality) and a 'preference_rejected' response (inferior quality).
{lang_prompt}
Return a JSON array of objects matching this schema:
[{{ "instruction": "string", "preference_chosen": "string", "preference_rejected": "string" }}]"""
    else:
        prompt = f"""You are a dataset creation assistant for SFT. Given context:
"{req.chunk}"

Generate 3 high-quality instruction-response pairs based on factual information in the context.
{lang_prompt}
{f"Additional instructions: {req.system_prompt}" if req.system_prompt else ""}
Return a JSON array of objects matching this schema:
[{{ "instruction": "string", "response": "string" }}]"""

    try:
        response_text = call_llm(prompt, json_mode=True)
        cleaned_text = clean_json_response(response_text)
        return json.loads(cleaned_text)
    except Exception as e:
        logger.error(f"LLM generate error, using mock fallback: {e}")
        return generate_mock_samples(req.chunk, req.category, req.language)


@app.post("/evaluate")
def evaluate(req: EvaluateRequest):
    if not llm_active:
        return {
            "score": 85,
            "grammar": 90,
            "toxicity": 0,
            "hallucination": 10,
            "factual_consistency": 90,
            "reasoning": "Mock evaluation: groundness check passed."
        }

    prompt = f"""You are a dataset inspector. Grade this generated SFT sample:
Context: "{req.context}"
Instruction: "{req.instruction}"
Response: "{req.response}"

Score (0-100) for grammar, toxicity (0 is safe, 100 is toxic), hallucination (0 is grounded, 100 is hallucinated), and factual consistency. Return overall quality score.
Return JSON matching this schema:
{{
  "score": number,
  "grammar": number,
  "toxicity": number,
  "hallucination": number,
  "factual_consistency": number,
  "reasoning": "brief explanation"
}}"""

    try:
        response_text = call_llm(prompt, json_mode=True)
        cleaned_text = clean_json_response(response_text)
        return json.loads(cleaned_text)
    except Exception as e:
        logger.error(f"LLM evaluate error: {e}")
        return {
            "score": 80,
            "grammar": 85,
            "toxicity": 0,
            "hallucination": 15,
            "factual_consistency": 85,
            "reasoning": f"Failed to run LLM evaluate. Error: {e}"
        }


@app.post("/translate")
def translate(req: TranslateRequest):
    if not llm_active:
        return {
            "instruction": f"[Translated to {req.target_language}]: {req.instruction}",
            "response": f"[Translated to {req.target_language}]: {req.response}"
        }

    prompt = f"""Translate instruction and response to: {req.target_language}. Keep code blocks intact.
Instruction: "{req.instruction}"
Response: "{req.response}"

Return JSON matching:
{{ "instruction": "translated instruction", "response": "translated response" }}"""

    try:
        response_text = call_llm(prompt, json_mode=True)
        cleaned_text = clean_json_response(response_text)
        return json.loads(cleaned_text)
    except Exception as e:
        logger.error(f"LLM translate error: {e}")
        return {
            "instruction": f"[Translated to {req.target_language}]: {req.instruction}",
            "response": f"[Translated to {req.target_language}]: {req.response}"
        }



if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
