from flask import Flask, request, jsonify, send_from_directory
import os
import cv2
import numpy as np
import mediapipe as mp
import tempfile
import uuid
import logging
from werkzeug.utils import secure_filename
from flask_cors import CORS

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__, static_folder='static')
CORS(app)  # Enable CORS for all routes

# Configure upload settings
UPLOAD_FOLDER = os.path.join(tempfile.gettempdir(), 'joint_angle_analysis')
ALLOWED_EXTENSIONS = {'mp4', 'avi', 'mov', 'webm', 'mkv'}
MAX_CONTENT_LENGTH = 100 * 1024 * 1024  # 100MB limit

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = MAX_CONTENT_LENGTH

# Create upload folder if it doesn't exist
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Initialize MediaPipe pose
mp_pose = mp.solutions.pose
mp_drawing = mp.solutions.drawing_utils
mp_drawing_styles = mp.solutions.drawing_styles

# Helper function to check if file extension is allowed
def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# Calculate angle between three points
def calculate_angle(a, b, c):
    # Convert points to numpy arrays
    a = np.array(a)
    b = np.array(b)
    c = np.array(c)
    
    # Calculate vectors
    ba = a - b
    bc = c - b
    
    # Calculate dot product
    cosine_angle = np.dot(ba, bc) / (np.linalg.norm(ba) * np.linalg.norm(bc))
    
    # Ensure value is within valid range for arccos
    cosine_angle = np.clip(cosine_angle, -1.0, 1.0)
    
    # Calculate angle in degrees
    angle = np.arccos(cosine_angle) * 180.0 / np.pi
    
    return angle

# Process a video to extract pose landmarks and calculate joint angles
def process_video(video_path, output_path=None, skeleton_mode=False):
    try:
        # Open video file
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            logger.error(f"Error opening video file: {video_path}")
            return {"error": "Failed to open video file"}
        
        # Get video properties
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        fps = cap.get(cv2.CAP_PROP_FPS)
        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        
        # Prepare output video if needed
        if output_path:
            # Ensure directory exists
            os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
            # Use a more compatible codec
            fourcc = cv2.VideoWriter_fourcc(*'XVID')
            out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))
            
            # Verify VideoWriter was initialized correctly
            if not out.isOpened():
                logger.warning(f"Failed to initialize VideoWriter. Output may not be saved.")
        
        # Initialize pose detector with appropriate settings
        with mp_pose.Pose(
            static_image_mode=False,
            model_complexity=2,  # Higher accuracy
            enable_segmentation=True,  # Always enable segmentation
            smooth_segmentation=True,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5) as pose:
            
            # Initialize results
            angle_data = []
            frame_idx = 0
            
            # Process each frame in the video
            while cap.isOpened():
                success, frame = cap.read()
                if not success:
                    break
                
                # Calculate progress
                progress = (frame_idx / frame_count) * 100
                
                # Convert the BGR image to RGB
                frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                
                # Process the frame with MediaPipe
                results = pose.process(frame_rgb)
                
                # Initialize angles for this frame
                frame_angles = {"timestamp": frame_idx / fps}
                
                # Check if pose landmarks were detected
                if results.pose_landmarks:
                    landmarks = results.pose_landmarks.landmark
                    
                    # Prepare a copy of the frame for drawing
                    if output_path:
                        # Create a frame for drawing
                        annotated_frame = frame.copy()
                        
                        # Apply skeleton mode if enabled
                        if skeleton_mode:
                            # Create a completely black background
                            annotated_frame = np.zeros_like(frame)
                            
                            # Custom drawing specs for better visibility in skeleton mode
                            landmark_spec = mp_drawing.DrawingSpec(
                                color=(0, 255, 0),  # Bright green for landmarks
                                thickness=5,
                                circle_radius=5
                            )
                            connection_spec = mp_drawing.DrawingSpec(
                                color=(255, 255, 255),  # White for connections
                                thickness=3
                            )
                        else:
                            # Default drawing specs for normal mode
                            landmark_spec = mp_drawing.DrawingSpec(
                                color=(0, 0, 255),  # Blue for landmarks
                                thickness=3,
                                circle_radius=3
                            )
                            connection_spec = mp_drawing.DrawingSpec(
                                color=(0, 255, 0),  # Green for connections
                                thickness=2
                            )
                        
                        # Draw pose landmarks
                        mp_drawing.draw_landmarks(
                            image=annotated_frame,
                            landmark_list=results.pose_landmarks,
                            connections=mp_pose.POSE_CONNECTIONS,
                            landmark_drawing_spec=landmark_spec,
                            connection_drawing_spec=connection_spec)
                    
                    # Calculate left elbow angle
                    left_shoulder = [landmarks[mp_pose.PoseLandmark.LEFT_SHOULDER.value].x,
                                    landmarks[mp_pose.PoseLandmark.LEFT_SHOULDER.value].y]
                    left_elbow = [landmarks[mp_pose.PoseLandmark.LEFT_ELBOW.value].x,
                                landmarks[mp_pose.PoseLandmark.LEFT_ELBOW.value].y]
                    left_wrist = [landmarks[mp_pose.PoseLandmark.LEFT_WRIST.value].x,
                                landmarks[mp_pose.PoseLandmark.LEFT_WRIST.value].y]
                    
                    left_elbow_angle = calculate_angle(left_shoulder, left_elbow, left_wrist)
                    frame_angles["leftElbow"] = left_elbow_angle
                    
                    # Calculate right elbow angle
                    right_shoulder = [landmarks[mp_pose.PoseLandmark.RIGHT_SHOULDER.value].x,
                                    landmarks[mp_pose.PoseLandmark.RIGHT_SHOULDER.value].y]
                    right_elbow = [landmarks[mp_pose.PoseLandmark.RIGHT_ELBOW.value].x,
                                landmarks[mp_pose.PoseLandmark.RIGHT_ELBOW.value].y]
                    right_wrist = [landmarks[mp_pose.PoseLandmark.RIGHT_WRIST.value].x,
                                 landmarks[mp_pose.PoseLandmark.RIGHT_WRIST.value].y]
                    
                    right_elbow_angle = calculate_angle(right_shoulder, right_elbow, right_wrist)
                    frame_angles["rightElbow"] = right_elbow_angle
                    
                    # Calculate left shoulder angle
                    left_hip = [landmarks[mp_pose.PoseLandmark.LEFT_HIP.value].x,
                              landmarks[mp_pose.PoseLandmark.LEFT_HIP.value].y]
                    
                    left_shoulder_angle = calculate_angle(left_hip, left_shoulder, left_elbow)
                    frame_angles["leftShoulder"] = left_shoulder_angle
                    
                    # Calculate right shoulder angle
                    right_hip = [landmarks[mp_pose.PoseLandmark.RIGHT_HIP.value].x,
                               landmarks[mp_pose.PoseLandmark.RIGHT_HIP.value].y]
                    
                    right_shoulder_angle = calculate_angle(right_hip, right_shoulder, right_elbow)
                    frame_angles["rightShoulder"] = right_shoulder_angle
                    
                    # Calculate left knee angle
                    left_hip = [landmarks[mp_pose.PoseLandmark.LEFT_HIP.value].x,
                              landmarks[mp_pose.PoseLandmark.LEFT_HIP.value].y]
                    left_knee = [landmarks[mp_pose.PoseLandmark.LEFT_KNEE.value].x,
                               landmarks[mp_pose.PoseLandmark.LEFT_KNEE.value].y]
                    left_ankle = [landmarks[mp_pose.PoseLandmark.LEFT_ANKLE.value].x,
                                landmarks[mp_pose.PoseLandmark.LEFT_ANKLE.value].y]
                    
                    left_knee_angle = calculate_angle(left_hip, left_knee, left_ankle)
                    frame_angles["leftKnee"] = left_knee_angle
                    
                    # Calculate right knee angle
                    right_hip = [landmarks[mp_pose.PoseLandmark.RIGHT_HIP.value].x,
                               landmarks[mp_pose.PoseLandmark.RIGHT_HIP.value].y]
                    right_knee = [landmarks[mp_pose.PoseLandmark.RIGHT_KNEE.value].x,
                                landmarks[mp_pose.PoseLandmark.RIGHT_KNEE.value].y]
                    right_ankle = [landmarks[mp_pose.PoseLandmark.RIGHT_ANKLE.value].x,
                                 landmarks[mp_pose.PoseLandmark.RIGHT_ANKLE.value].y]
                    
                    right_knee_angle = calculate_angle(right_hip, right_knee, right_ankle)
                    frame_angles["rightKnee"] = right_knee_angle
                    
                    # Draw angles on the frame if output path is provided
                    if output_path:
                        # Set text color based on mode (white for skeleton mode, white with black outline for normal)
                        text_color = (255, 255, 255) if skeleton_mode else (255, 255, 255)
                        outline_color = (0, 0, 0)
                        
                        # Helper function to draw angle
                        def draw_angle(frame, point, angle, joint_name):
                            x = int(point[0] * width)
                            y = int(point[1] * height)
                            
                                                    # Make sure coordinates are within image bounds
                            if 0 <= x < width and 0 <= y < height:
                                # Text to display
                                text = f"{joint_name}: {angle:.1f}°"
                                
                                try:
                                    if not skeleton_mode:
                                        # Draw black outline in normal mode
                                        cv2.putText(frame, text, (x, y), 
                                                  cv2.FONT_HERSHEY_SIMPLEX, 0.5,
                                                  outline_color, 4, cv2.LINE_AA)
                                    
                                    # Draw text
                                    cv2.putText(frame, text, (x, y), 
                                              cv2.FONT_HERSHEY_SIMPLEX, 0.5,
                                              text_color, 2, cv2.LINE_AA)
                                except Exception as text_error:
                                    logger.warning(f"Error drawing text: {text_error}")
                            
                            # Draw angle arc with color based on mode
                            arc_color = (0, 255, 0) if skeleton_mode else (0, 255, 0)
                            radius = 30
                            
                            # Make sure coordinates are within image bounds
                            if 0 <= x < width and 0 <= y < height:
                                try:
                                    cv2.ellipse(frame, (x, y), (radius, radius), 0, 0, angle,
                                              arc_color, 2, cv2.LINE_AA)
                                except Exception as arc_error:
                                    logger.warning(f"Error drawing arc: {arc_error}")
                        
                        # Draw all angles
                        draw_angle(annotated_frame, left_elbow, left_elbow_angle, "L Elbow")
                        draw_angle(annotated_frame, right_elbow, right_elbow_angle, "R Elbow")
                        draw_angle(annotated_frame, left_shoulder, left_shoulder_angle, "L Shoulder")
                        draw_angle(annotated_frame, right_shoulder, right_shoulder_angle, "R Shoulder")
                        draw_angle(annotated_frame, left_knee, left_knee_angle, "L Knee")
                        draw_angle(annotated_frame, right_knee, right_knee_angle, "R Knee")
                        
                        # Add timestamp with appropriate visibility
                        time_text = f"Time: {frame_idx / fps:.2f}s"
                        if not skeleton_mode:
                            # Add outline in normal mode
                            cv2.putText(annotated_frame, time_text, (10, 30),
                                      cv2.FONT_HERSHEY_SIMPLEX, 1, outline_color, 4, cv2.LINE_AA)
                        
                        cv2.putText(annotated_frame, time_text, (10, 30),
                                  cv2.FONT_HERSHEY_SIMPLEX, 1, text_color, 2, cv2.LINE_AA)
                        
                        # Write the frame to output video
                        out.write(annotated_frame)
                
                # Add angles data to results
                angle_data.append(frame_angles)
                
                # Increment frame counter
                frame_idx += 1
            
            # Release resources
            cap.release()
            if output_path:
                out.release()
            
            return {
                "success": True,
                "data": angle_data,
                "video_info": {
                    "frame_count": frame_count,
                    "fps": fps,
                    "width": width,
                    "height": height,
                    "duration": frame_count / fps
                }
            }
    
    except Exception as e:
        logger.error(f"Error processing video: {str(e)}")
        return {"success": False, "error": str(e)}

# API Routes
@app.route('/')
def index():
    return send_from_directory('static', 'index.html')

@app.route('/api/upload', methods=['POST'])
def upload_video():
    if 'video' not in request.files:
        return jsonify({"success": False, "error": "No video file provided"}), 400
    
    file = request.files['video']
    
    if file.filename == '':
        return jsonify({"success": False, "error": "No file selected"}), 400
    
    if not allowed_file(file.filename):
        return jsonify({"success": False, "error": "File type not allowed"}), 400
    
    try:
        # Generate unique filename
        filename = secure_filename(file.filename)
        unique_id = str(uuid.uuid4())
        base_name, extension = os.path.splitext(filename)
        unique_filename = f"{base_name}_{unique_id}{extension}"
        
        # Save uploaded file
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
        file.save(file_path)
        
        # Log file details for debugging
        logger.info(f"Saved file to {file_path}")
        
        # Process video based on options - explicitly convert to boolean
        skeleton_mode_str = request.form.get('skeletonMode', 'false')
        skeleton_mode = skeleton_mode_str.lower() == 'true'
        logger.info(f"Skeleton mode: {skeleton_mode} (from value: {skeleton_mode_str})")
        
        save_data_str = request.form.get('saveData', 'false')
        save_data = save_data_str.lower() == 'true'
        logger.info(f"Save data: {save_data} (from value: {save_data_str})")
        
        # Generate processed video path if save_data is true
        processed_video_path = None
        if save_data:
            processed_video_path = os.path.join(
                app.config['UPLOAD_FOLDER'], 
                f"{base_name}_{unique_id}_processed{extension}"
            )
            logger.info(f"Will save processed video to {processed_video_path}")
        
        # Process the video
        result = process_video(file_path, processed_video_path, skeleton_mode)
        
        if not result.get("success", False):
            logger.error(f"Video processing failed: {result.get('error', 'Unknown error')}")
            return jsonify(result), 500
        
        # Add file paths to result
        result["original_video"] = f"/api/videos/{unique_filename}"
        
        if save_data and processed_video_path:
            processed_filename = os.path.basename(processed_video_path)
            result["processed_video"] = f"/api/videos/{processed_filename}"
            
            # Verify the processed video exists
            if os.path.exists(processed_video_path):
                logger.info(f"Processed video saved successfully at {processed_video_path}")
            else:
                logger.warning(f"Processed video was not found at {processed_video_path}")
        
        return jsonify(result)
    
    except Exception as e:
        logger.error(f"Error in upload_video: {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/videos/<filename>')
def get_video(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

@app.route('/api/analyze', methods=['POST'])
def analyze_video():
    try:
        # Get the video path from the request
        data = request.get_json()
        video_path = data.get('video_path')
        
        if not video_path:
            return jsonify({"success": False, "error": "No video path provided"}), 400
        
        # If the path is a URL, download the video first
        if video_path.startswith('http'):
            # Download logic here
            pass
        else:
            # If it's a path to a local file, ensure it's in the upload folder
            video_path = os.path.join(app.config['UPLOAD_FOLDER'], os.path.basename(video_path))
        
        # Get processing options
        skeleton_mode = data.get('skeletonMode', False)
        
        # Process the video
        result = process_video(video_path, None, skeleton_mode)
        
        return jsonify(result)
    
    except Exception as e:
        logger.error(f"Error in analyze_video: {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500

# Start the server
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)