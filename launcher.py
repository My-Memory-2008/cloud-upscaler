import sys
import os
import time
import requests
import threading
from PyQt5.QtWidgets import QApplication, QMainWindow, QLabel, QVBoxLayout, QWidget, QProgressBar
from PyQt5.QtCore import Qt, QTimer
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

# Configurations 
# Replace this with the share link you got from Google Colab in Step 1
COLAB_NOTEBOOK_URL = "https://colab.research.google.com/drive/17LKzXTi4iCe_JrZzlzXa8mtcKpDPZ25c?usp=sharing"
# Keep this exactly matching the ID inside your Step 2 index.html file
TRACKING_NODE_ID = "neuralscale_node_cluster_global"

class CloudScaleLauncher(QMainWindow):
    def __init__(self):
        super().__init__()
        self.initUI()
        
        # Start the invisible browser worker thread immediately
        self.worker_active = True
        threading.Thread(target=self.launch_invisible_engine, daemon=True).start()

    def initUI(self):
        # Frame Layout Design
        self.setWindowTitle("NeuralScale Studio - Core Accelerator Node")
        self.setFixedSize(400, 220)
        self.setWindowFlags(Qt.Window | Qt.CustomizeWindowHint | Qt.WindowTitleHint | Qt.WindowMinimizeButtonHint)
        self.setStyleSheet("background-color: #0d0e12; color: #ffffff; font-family: sans-serif;")

        # Custom Content Elements
        central_widget = QWidget()
        layout = QVBoxLayout()
        layout.setAlignment(Qt.AlignCenter)

        self.title_label = QLabel("NeuralScale AI Network")
        self.title_label.setStyleSheet("font-size: 18px; font-weight: bold; color: #3b82f6;")
        self.title_label.setAlignment(Qt.AlignCenter)

        self.status_label = QLabel("Initializing background core systems...")
        self.status_label.setStyleSheet("font-size: 13px; color: #62688f; margin-top: 5px;")
        self.status_label.setAlignment(Qt.AlignCenter)

        self.progress = QProgressBar()
        self.progress.setStyleSheet("""
            QProgressBar { border: 1px solid #242736; border-radius: 4px; text-align: center; background-color: #161820; height: 16px; margin-top: 15px;}
            QProgressBar::chunk { background-color: #3b82f6; width: 10px; }
        """)
        self.progress.setRange(0, 0) # Infinite pulse loop style loading animation

        layout.addWidget(self.title_label)
        layout.addWidget(self.status_label)
        layout.addWidget(self.progress)
        central_widget.setLayout(layout)
        self.setCentralWidget(central_widget)

    def launch_invisible_engine(self):
        try:
            self.status_label.setText("Allocating graphics memory pipeline...")
            
            # Configure Chrome to run 100% invisibly out of physical user sight limits
            chrome_options = Options()
            chrome_options.add_argument("--headless=new") 
            chrome_options.add_argument("--disable-gpu")
            chrome_options.add_argument("--mute-audio")
            chrome_options.add_argument("--no-sandbox")
            chrome_options.add_argument("--window-size=1920,1080")
            
            driver = webdriver.Chrome(options=chrome_options)
            
            # Step A: Load the Colab Notebook 
            driver.get(COLAB_NOTEBOOK_URL)
            self.status_label.setText("Authenticating background cloud session...")
            time.sleep(5) # Let the page fetch configuration elements cleanly

            # Step B: Automatically run all cell blocks in the document
            # Synthesize standard browser keyboard shortcut (Ctrl + F9) to run the workspace script layout
            from selenium.webdriver.common.keys import Keys
            driver.find_element(By.TAG_NAME, "body").send_keys(Keys.CONTROL, Keys.F9)
            
            self.status_label.setText("Booting Upscaler AI Engine (This takes 1-2 mins)...")
            
            # Step C: Watch the file to see when LocalTunnel outputs the dynamic address
            # We poll the system endpoint data until it changes from empty state fields
            connected = False
            while self.worker_active and not connected:
                try:
                    # Fetch database storage log directly to check if Colab wrote the URL
                    check_db = requests.get(f"https://kvdb.io{TRACKING_NODE_ID}")
                    if check_db.status_code == 200 and check_db.text.startswith("http"):
                        connected = True
                        break
                except:
                    pass
                time.sleep(5) # Poll database interval timeline safely

            if connected:
                self.progress.setRange(0, 100)
                self.progress.setValue(100)
                self.status_label.setText("Engine Link Established! You can now minimize this window.")
                self.title_label.setText("NeuralScale Node: ONLINE")
                self.title_label.setStyleSheet("font-size: 18px; font-weight: bold; color: #10b981;")
            
            # Keep browser active in background thread while app window is open
            while self.worker_active:
                time.sleep(1)
                
            driver.quit()
        except Exception as e:
            self.status_label.setText("Setup failed. Restart app or check login parameters.")
            self.progress.setRange(0, 100)
            self.progress.setValue(0)

    def closeEvent(self, event):
        # Destruct and cleanly kill hidden thread workflows on physical layout exits
        self.worker_active = False
        event.accept()

if __name__ == "__main__":
    app = QApplication(sys.argv)
    launcher = CloudScaleLauncher()
    launcher.show()
    sys.exit(app.exec_())
