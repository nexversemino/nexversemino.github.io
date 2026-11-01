@echo off
cd /d "%~dp0"
echo MORFIAI: http://127.0.0.1:4182
python -X utf8 scripts\preview.py
pause
