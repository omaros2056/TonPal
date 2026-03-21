import logging
import threading
import os
from dotenv import load_dotenv, dotenv_values 
from flask import Flask, render_template_string
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo
from telegram.ext import ApplicationBuilder, ContextTypes, CommandHandler

# --- CONFIGURATION ---
TOKEN = os.getenv("NGROK_KEY")
WEB_APP_URL = "https://precontractive-acidifiable-launa.ngrok-free.dev/gui"

app = Flask(__name__)

@app.route('/gui')
def mini_app_ui():
    html_content = """
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <script src="https://telegram.org/js/telegram-web-app.js"></script>
        <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700;800&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
        <style>
            :root {
                --primary: #00d2ff;
                --accent: #0072ff;
                --bg: #0b0e14;
                --glass: rgba(255, 255, 255, 0.03);
                --glass-border: rgba(255, 255, 255, 0.1);
                --shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.8);
            }
            
            * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
            body { 
                margin: 0; padding: 0; font-family: 'Montserrat', sans-serif;
                background: var(--bg); color: white; overflow: hidden; height: 100vh;
            }

            #bg-canvas { position: fixed; top: 0; left: 0; z-index: -1; }

            .app-wrapper { 
                padding: 25px; display: flex; flex-direction: column; 
                align-items: center; z-index: 1; position: relative; perspective: 1000px;
            }
            
            .header { text-align: center; margin-bottom: 40px; transform: translateZ(50px); }
            .header h1 { 
                margin: 0; font-size: 32px; font-weight: 800; letter-spacing: 4px;
                text-shadow: 0 0 20px rgba(0, 210, 255, 0.5);
                font-family: 'Montserrat', sans-serif;
            }
            .header p { 
                margin: 5px 0; color: var(--primary); font-size: 10px; 
                font-family: 'JetBrains Mono', monospace; font-weight: 700;
                letter-spacing: 3px; opacity: 0.8;
            }

            .grid-container {
                display: grid; grid-template-columns: 1fr 1fr; gap: 20px; 
                width: 100%; max-width: 420px; transform-style: preserve-3d;
            }

            /* 3D Neumorphic Glass Card */
            .menu-card {
                background: linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0) 100%);
                backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
                border: 1px solid var(--glass-border); border-radius: 28px; padding: 30px 15px;
                text-align: center; cursor: pointer; position: relative;
                transition: all 0.2s cubic-bezier(0.2, 0, 0.4, 1);
                box-shadow: 
                    inset 2px 2px 5px rgba(255,255,255,0.05),
                    inset -2px -2px 5px rgba(0,0,0,0.5),
                    0 15px 35px rgba(0,0,0,0.5);
                transform: translateZ(20px);
            }

            .menu-card:active {
                transform: translateZ(5px) scale(0.96);
                box-shadow: inset 5px 5px 10px rgba(0,0,0,0.8);
                border-color: var(--primary);
            }

            .card-icon { 
                font-size: 36px; margin-bottom: 12px; 
                filter: drop-shadow(0 0 12px var(--primary)); 
            }
            .card-label { 
                font-size: 13px; font-weight: 700; text-transform: uppercase; 
                letter-spacing: 1px; color: rgba(255,255,255,0.9);
            }

            /* Direct Transfer Special Styling */
            .full-width { grid-column: span 2; padding: 20px; }

            /* Modal Styling */
            .modal {
                position: fixed; inset: 0; background: #0b0e14; z-index: 1000;
                transform: translateY(110%); transition: transform 0.5s cubic-bezier(0.16, 1, 0.3, 1);
                display: flex; flex-direction: column; padding: 30px;
            }
            .modal.active { transform: translateY(0); }
            
            .modal-header h2 { font-weight: 800; font-size: 24px; margin: 0; }
            .back-btn { font-family: 'JetBrains Mono'; font-weight: bold; color: var(--primary); cursor: pointer; margin-bottom: 20px; display: block;}

            .input-box {
                background: rgba(0,0,0,0.3); border: 1px solid var(--glass-border);
                border-radius: 18px; padding: 18px; margin-bottom: 20px;
                box-shadow: inset 0 2px 10px rgba(0,0,0,0.5);
            }
            input { 
                background: transparent; border: none; color: white; width: 100%; 
                outline: none; font-size: 16px; font-family: 'JetBrains Mono';
            }

            .action-btn {
                background: linear-gradient(135deg, var(--primary), var(--accent));
                color: white; border: none; padding: 20px; border-radius: 22px;
                width: 100%; font-weight: 800; font-size: 15px; text-transform: uppercase;
                letter-spacing: 2px; box-shadow: 0 10px 30px rgba(0,210,255,0.3);
                cursor: pointer;
            }
        </style>
    </head>
    <body>

    <canvas id="bg-canvas"></canvas>

    <div class="app-wrapper">
        <div class="header">
            <p>NETWORK STATUS: ACTIVE</p>
            <h1>ALPHATON</h1>
        </div>

        <div class="grid-container">
            <div class="menu-card" onclick="openModal('modal-split')">
                <div class="card-icon">📊</div>
                <div class="card-label">Split Bill</div>
            </div>
            <div class="menu-card" onclick="openModal('modal-scan')">
                <div class="card-icon">🔍</div>
                <div class="card-label">AI Scan</div>
            </div>
            <div class="menu-card" onclick="openModal('modal-qr')">
                <div class="card-icon">⚡</div>
                <div class="card-label">My QR</div>
            </div>
            <div class="menu-card" onclick="openModal('modal-red')">
                <div class="card-icon">🧧</div>
                <div class="card-label">Giveaway</div>
            </div>
            <div class="menu-card full-width" onclick="openModal('modal-transfer')">
                <div class="card-icon" style="font-size: 28px;">🚀</div>
                <div class="card-label">Direct Node Transfer</div>
            </div>
        </div>
    </div>

    <div id="modal-split" class="modal">
        <div class="modal-header">
            <span class="back-btn" onclick="closeModal()">[ ESC_BACK ]</span>
            <h2>Group Node Split</h2>
        </div>
        <div class="modal-content">
            <div id="split-setup">
                <div class="input-box"><input id="bill-title" type="text" placeholder="SESSION_ID"></div>
                <div class="input-box"><input id="bill-total" type="number" placeholder="AMOUNT_ATON"></div>
                <button class="action-btn" onclick="startTracking()">Initialize Request</button>
            </div>
            <div id="split-details" style="display:none; text-align: center; margin-top: 50px;">
                <div class="card-icon" style="animation: pulse 2s infinite;">🛰️</div>
                <p style="font-family: 'JetBrains Mono'; color: var(--primary)">SYNCHRONIZING WITH BLOCKCHAIN...</p>
            </div>
        </div>
    </div>

    <script>
        let tg = window.Telegram.WebApp;
        tg.expand();
        tg.enableClosingConfirmation();
        tg.headerColor = '#0b0e14';

        // Particle System (Keep previous logic)
        const canvas = document.getElementById('bg-canvas');
        const ctx = canvas.getContext('2d');
        let particles = [];
        function initParticles() {
            canvas.width = window.innerWidth; canvas.height = window.innerHeight;
            particles = [];
            for(let i=0; i<70; i++) {
                particles.push({
                    x: Math.random() * canvas.width, y: Math.random() * canvas.height,
                    vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.4
                });
            }
        }
        function animate() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = 'rgba(0, 210, 255, 0.4)';
            ctx.strokeStyle = 'rgba(0, 210, 255, 0.1)';
            particles.forEach((p, i) => {
                p.x += p.vx; p.y += p.vy;
                if(p.x < 0 || p.x > canvas.width) p.vx *= -1;
                if(p.y < 0 || p.y > canvas.height) p.vy *= -1;
                ctx.beginPath(); ctx.arc(p.x, p.y, 1.5, 0, Math.PI*2); ctx.fill();
                for(let j=i+1; j<particles.length; j++) {
                    let p2 = particles[j];
                    let dist = Math.hypot(p.x - p2.x, p.y - p2.y);
                    if(dist < 100) {
                        ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
                    }
                }
            });
            requestAnimationFrame(animate);
        }
        window.addEventListener('resize', initParticles);
        initParticles(); animate();

        function openModal(id) {
            document.getElementById(id).classList.add('active');
            tg.HapticFeedback.impactOccurred('medium');
        }
        function closeModal() {
            document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
            tg.HapticFeedback.impactOccurred('light');
        }
        function startTracking() {
            document.getElementById('split-setup').style.display = 'none';
            document.getElementById('split-details').style.display = 'block';
            tg.HapticFeedback.notificationOccurred('success');
        }
    </script>
    </body>
    </html>
    """
    return render_template_string(html_content)

def run_flask():
    app.run(host="0.0.0.0", port=5001)

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    kb = [[InlineKeyboardButton(text="💎 Launch TonPal", web_app=WebAppInfo(url=WEB_APP_URL))]]
    await update.message.reply_text(
        "Welcome to the **AlphaTON Nexus**.\n\nSecure, decentralized group payments.",
        reply_markup=InlineKeyboardMarkup(kb),
        parse_mode="Markdown"
    )

if __name__ == '__main__':
    threading.Thread(target=run_flask, daemon=True).start()
    application = ApplicationBuilder().token(TOKEN).build()
    application.add_handler(CommandHandler('start', start))
    application.run_polling()