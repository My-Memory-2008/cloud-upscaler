import sys
import os
import time
import requests
import threading
import webbrowser
from PyQt5.QtWidgets import QApplication, QMainWindow, QLabel, QVBoxLayout, QWidget, QProgressBar, QPushButton
from PyQt5.QtCore import Qt

# Configurations
# Replace this with the share link you got from Google Colab in Step 1
COLAB_NOTEBOOK_URL = "https://colab.research.google.com/drive/17LKzXTi4iCe_JrZzlzXa8mtcKpDPZ25c?"
# Keep this exactly matching the ID inside your Step 2 index.html file
TRACKING_NODE_ID = "neuralscale_node_cluster_global"

class CloudScaleLauncher(QMainWindow):
    def __init__(self):
        super().__init__()
        self.initUI()
        self.worker_active = True
        
    def initUI(self):
        # Frame Layout Design
        self.setWindowTitle("NeuralScale Studio - Core Accelerator Node")
        self.setFixedSize(400, 240)
        self.setWindowFlags(Qt.Window | Qt.CustomizeWindowHint | Qt.WindowTitleHint | Qt.WindowMinimizeButtonHint)
        self.setStyleSheet("background-color: #0d0e12; color: #ffffff; font-family: sans-serif;")

        # Custom Content Elements
        central_widget = QWidget()
        layout = QVBoxLayout()
        layout.setAlignment(Qt.AlignCenter)

        self.title_label = QLabel("NeuralScale AI Network")
        self.title_label.setStyleSheet("font-size: 18px; font-weight: bold; color: #3b82f6;")
        self.title_label.setAlignment(Qt.AlignCenter)

        self.status_label = QLabel("Click below to link cloud processing arrays.")
        self.status_label.setStyleSheet("font-size: 13px; color: #62688f; margin-top: 5px;")
        self.status_label.setAlignment(Qt.AlignCenter)

        # Native Link Trigger Button
        self.link_btn = QPushButton("Link GPU Server")
        self.link_btn.setStyleSheet("""
            QPushButton { background-color: #3b82f6; color: white; border: none; font-weight: bold; padding: 10px; border-radius: 6px; margin-top: 15px; font-size: 14px; }
            QPushButton:hover { background-color: #2563eb; }
        """)
        self.link_btn.clicked.connect(self.trigger_hardware_connection)

        self.progress = QProgressBar()
        self.progress.setStyleSheet("""
            QProgressBar { border: 1px solid #242736; border-radius: 4px; text-align: center; background-color: #161820; height: 16px; margin-top: 15px;}
            QProgressBar::chunk { background-color: #10b981; width: 10px; }
        """)
        self.progress.setVisible(False)

        layout.addWidget(self.title_label)
        layout.addWidget(self.status_label)
        layout.addWidget(self.link_btn)
        layout.addWidget(self.progress)
        central_widget.setLayout(layout)
        self.setCentralWidget(central_widget)

    def trigger_hardware_connection(self):
        # Disable button and activate progress UI elements
        self.link_btn.setVisible(False)
        self.progress.setVisible(True)
        self.progress.setRange(0, 0)
        self.status_label.setText("Please execute the Colab environment tab in your browser...")

        # Securely launch the user's native system default browser to avoid bot blocks
        webbrowser.open(COLAB_NOTEBOOK_URL)

        # Fire off database network listener daemon thread
        threading.Thread(target=self.listen_for_active_handshake, daemon=True).start()

    def listen_for_active_handshake(self):
        connected = False
        while self.worker_active and not connected:
            try:
                # Poll data layer logs to verify when Colab establishes an endpoint url
                check_db = requests.get(f"https://kvdb.io{TRACKING_NODE_ID}")
                if check_db.status_code == 200 and check_db.text.startswith("http"):
                    connected = True
                    break
            except:
                pass
            time.sleep(4)

        if connected:
            self.progress.setRange(0, 100)
            self.progress.setValue(100)
            self.status_label.setText("Engine Link Established! You can safely minimize this panel.")
            self.title_label.setText("NeuralScale Node: ONLINE")
            self.title_label.setStyleSheet("font-size: 18px; font-weight: bold; color: #10b981;")

    def closeEvent(self, event):
        self.worker_active = False
        event.accept()

if __name__ == "__main__":
    app = QApplication(sys.argv)
    launcher = CloudScaleLauncher()
    launcher.show()
    sys.exit(app.exec_())
