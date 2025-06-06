#!/bin/bash
echo "Starting development environment"

# cd /home/eimantas/git/gemini-invoice/frontend || exit
/usr/bin/kitty -e npm run dev --prefix /home/eimantas/git/github-invoice/frontend/ &

cd /home/eimantas/git/github-invoice/backend || exit
source /home/eimantas/git/github-invoice/backend/venv/bin/activate && uvicorn app.main:app --reload --port 8000
