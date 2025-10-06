import os
import requests
from datetime import datetime

# HH.ru токен (из переменных окружения)
HH_TOKEN = os.getenv("HH_TOKEN_1")

# Вебхук Bitrix24
BITRIX_WEBHOOK = "https://nta-company.bitrix24.ru/rest/56435/j7rzo0xhs0ityawj/"

# Основные настройки
HH_HEADERS = {"Authorization": f"Bearer {HH_TOKEN}"}

def get_hh_responses():
    """Получаем новые отклики из hh.ru"""
    url = "https://api.hh.ru/negotiations"
    resp = requests.get(url, headers=HH_HEADERS)
    if resp.status_code != 200:
        return []
    data = resp.json()
    return data.get("items", [])


def get_resume_pdf(resume_id):
    """Скачиваем резюме в PDF"""
    pdf_url = f"https://api.hh.ru/resumes/{resume_id}/download"
    resp = requests.get(pdf_url, headers=HH_HEADERS)
    if resp.status_code == 200:
        filename = f"/tmp/{resume_id}.pdf"
        with open(filename, "wb") as f:
            f.write(resp.content)
        return filename
    return None


def create_bitrix_deal(name, phone, email, resume_path):
    """Создаём сделку в Bitrix24 и прикрепляем PDF"""
    deal_data = {
        "fields": {
            "TITLE": f"Кандидат HH.ru: {name}",
            "STAGE_ID": "NEW",  # можно потом уточнить конкретный ID стадии в "Найм персонала"
            "CATEGORY_ID": 5,   # ID воронки "Найм персонала" — заменить на реальный
            "COMMENTS": f"Создано автоматически {datetime.now()}"
        }
    }

    # Создание сделки
    deal_resp = requests.post(f"{BITRIX_WEBHOOK}crm.deal.add.json", json=deal_data)
    deal_id = deal_resp.json().get("result")

    # Прикрепляем файл
    if deal_id and resume_path:
        with open(resume_path, "rb") as f:
            file_data = f.read()
        upload_resp = requests.post(
            f"{BITRIX_WEBHOOK}crm.deal.file.add.json",
            files={"file": (os.path.basename(resume_path), file_data)}
        )
        print("PDF прикреплён:", upload_resp.status_code)
    return deal_id


def handler(request):
    """Основная функция (Vercel entrypoint)"""
    try:
        responses = get_hh_responses()
        created = []

        for r in responses:
            candidate = r.get("resume", {}).get("fio", "Без имени")
            resume_id = r.get("resume", {}).get("id")
            email = r.get("resume", {}).get("contact", {}).get("email", "")
            phone = r.get("resume", {}).get("contact", {}).get("phone", "")

            pdf_path = get_resume_pdf(resume_id)
            deal_id = create_bitrix_deal(candidate, phone, email, pdf_path)
            created.append({"deal_id": deal_id, "name": candidate})

        return {
            "statusCode": 200,
            "body": {"status": "ok", "created": created}
        }

    except Exception as e:
        return {
            "statusCode": 500,
            "body": {"error": str(e)}
        }
