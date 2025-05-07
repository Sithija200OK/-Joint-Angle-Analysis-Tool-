Joint Angle Analysis Tool
A high-quality web application for real-time analysis of human joint angles using MediaPipe and OpenCV.
Features

Upload videos for joint angle analysis
Real-time tracking and measurement of knee, elbow, and shoulder angles
Live updating data table and charts
Skeleton mode visualization
Data export functionality
Summary statistics with maximum angles reached

Tech Stack

Frontend: HTML, CSS, JavaScript, Chart.js
Backend: Python, Flask
Computer Vision: MediaPipe, OpenCV

Project Structure
joint-angle-analysis/
│
├── static/
│   ├── index.html          # Main HTML structure
│   ├── styles.css          # CSS styling
│   └── script.js           # Frontend JavaScript
│
├── server.py               # Flask backend with MediaPipe processing
├── requirements.txt        # Python dependencies
└── README.md               # Project documentation
Getting Started
Prerequisites

Python 3.7 or higher
Node.js (optional, for development tools)

Installation

Clone the repository:
git clone https://github.com/yourusername/joint-angle-analysis.git
cd joint-angle-analysis

Create and activate a virtual environment:
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

Install dependencies:
pip install -r requirements.txt


Running the Application

Start the Flask server:
python server.py

Open your browser and navigate to:
http://localhost:5000


Usage Guide

Upload a Video:

Click the upload area or drag and drop a video file
Supported formats: MP4, AVI, MOV, WEBM, MKV


Configure Options:

Toggle "Skeleton Mode" to isolate the skeletal structure
Toggle "Save Data" to save processed video


Start Analysis:

Click "Start Analysis" to begin processing
View real-time joint angle data in the table


View Results:

Switch between "Data Table", "Charts", and "Summary" tabs
Select specific joints to filter the data view


Export Data:

Click "Download Data" to export angle measurements as CSV



Development
To modify the frontend:

Edit the files in the static folder
Refresh the browser to see changes

To modify the backend:

Edit server.py
Restart the Flask server

License
This project is licensed under the MIT License - see the LICENSE file for details.
Acknowledgments

MediaPipe for pose estimation
OpenCV for computer vision processing
Chart.js for data visualization