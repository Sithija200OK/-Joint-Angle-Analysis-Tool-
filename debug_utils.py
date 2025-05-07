"""
Debug utility to test skeleton mode visualization with joint angle measurements.
This script helps verify if the pose detection, skeleton visualization, and angle measurements are working properly.
"""

import cv2
import numpy as np
import mediapipe as mp
import sys
import os
import math

def calculate_angle(a, b, c):
    """
    Calculate the angle between three points.
    
    Args:
        a: First point [x, y]
        b: Mid point [x, y] (vertex of the angle)
        c: Last point [x, y]
        
    Returns:
        Angle in degrees
    """
    # Convert landmarks to numpy arrays for vector calculations
    a = np.array([a.x, a.y])
    b = np.array([b.x, b.y])
    c = np.array([c.x, c.y])
    
    # Calculate vectors
    ba = a - b
    bc = c - b
    
    # Calculate dot product
    cosine_angle = np.dot(ba, bc) / (np.linalg.norm(ba) * np.linalg.norm(bc))
    
    # Handle numerical errors that can cause value outside [-1,1]
    cosine_angle = np.clip(cosine_angle, -1.0, 1.0)
    
    # Calculate angle in degrees
    angle = np.arccos(cosine_angle) * 180.0 / np.pi
    
    return angle

def test_skeleton_mode(video_path, output_path):
    """
    Process a video with skeleton mode and save the output for inspection.
    Display joint angles for key joints in the body.
    
    Args:
        video_path: Path to input video
        output_path: Path to save processed video
    """
    print(f"Processing video: {video_path}")
    print(f"Output will be saved to: {output_path}")
    
    # Initialize MediaPipe pose
    mp_pose = mp.solutions.pose
    mp_drawing = mp.solutions.drawing_utils
    
    # Open video
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(f"Error: Could not open video {video_path}")
        return False
    
    # Get video properties
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS)
    print(f"Video dimensions: {width}x{height}, FPS: {fps}")
    
    # Create output directory if needed
    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    
    # Initialize video writer
    fourcc = cv2.VideoWriter_fourcc(*'XVID')
    out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))
    
    if not out.isOpened():
        print("Error: Could not initialize video writer")
        return False
    
    # Custom drawing specs
    landmark_spec = mp_drawing.DrawingSpec(
        color=(0, 255, 0),  # Bright green
        thickness=5,
        circle_radius=5
    )
    connection_spec = mp_drawing.DrawingSpec(
        color=(255, 255, 255),  # White
        thickness=3
    )
    
    # Define the key angles to track
    # Format: (name, [point1_idx, point2_idx (vertex), point3_idx])
    angles_to_track = [
        ("Right Elbow", [mp_pose.PoseLandmark.RIGHT_SHOULDER.value, 
                        mp_pose.PoseLandmark.RIGHT_ELBOW.value, 
                        mp_pose.PoseLandmark.RIGHT_WRIST.value]),
        
        ("Left Elbow", [mp_pose.PoseLandmark.LEFT_SHOULDER.value, 
                       mp_pose.PoseLandmark.LEFT_ELBOW.value, 
                       mp_pose.PoseLandmark.LEFT_WRIST.value]),
        
        ("Right Knee", [mp_pose.PoseLandmark.RIGHT_HIP.value, 
                       mp_pose.PoseLandmark.RIGHT_KNEE.value, 
                       mp_pose.PoseLandmark.RIGHT_ANKLE.value]),
        
        ("Left Knee", [mp_pose.PoseLandmark.LEFT_HIP.value, 
                      mp_pose.PoseLandmark.LEFT_KNEE.value, 
                      mp_pose.PoseLandmark.LEFT_ANKLE.value]),
        
        ("Right Shoulder", [mp_pose.PoseLandmark.RIGHT_ELBOW.value, 
                           mp_pose.PoseLandmark.RIGHT_SHOULDER.value, 
                           mp_pose.PoseLandmark.RIGHT_HIP.value]),
        
        ("Left Shoulder", [mp_pose.PoseLandmark.LEFT_ELBOW.value, 
                          mp_pose.PoseLandmark.LEFT_SHOULDER.value, 
                          mp_pose.PoseLandmark.LEFT_HIP.value]),
        
        ("Right Hip", [mp_pose.PoseLandmark.RIGHT_KNEE.value, 
                      mp_pose.PoseLandmark.RIGHT_HIP.value, 
                      mp_pose.PoseLandmark.RIGHT_SHOULDER.value]),
        
        ("Left Hip", [mp_pose.PoseLandmark.LEFT_KNEE.value, 
                     mp_pose.PoseLandmark.LEFT_HIP.value, 
                     mp_pose.PoseLandmark.LEFT_SHOULDER.value])
    ]
    
    # Process video frames
    frame_count = 0
    with mp_pose.Pose(
        static_image_mode=False,
        model_complexity=2,
        enable_segmentation=True,
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5) as pose:
        
        while cap.isOpened():
            success, frame = cap.read()
            if not success:
                break
            
            # Convert to RGB
            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            
            # Process with MediaPipe
            results = pose.process(frame_rgb)
            
            # Create black background for skeleton
            black_frame = np.zeros_like(frame)
            
            # Draw skeleton if landmarks detected
            if results.pose_landmarks:
                mp_drawing.draw_landmarks(
                    black_frame,
                    results.pose_landmarks,
                    mp_pose.POSE_CONNECTIONS,
                    landmark_drawing_spec=landmark_spec,
                    connection_drawing_spec=connection_spec
                )
                
                # Calculate and display angles
                landmarks = results.pose_landmarks.landmark
                
                # Display angle for each key joint
                y_offset = 60  # Start position for angle text
                for angle_name, (p1, p2, p3) in angles_to_track:
                    # Check if all landmarks for this angle are detected with sufficient confidence
                    # (visibility is a field in MediaPipe landmarks that indicates confidence)
                    if (landmarks[p1].visibility > 0.5 and 
                        landmarks[p2].visibility > 0.5 and 
                        landmarks[p3].visibility > 0.5):
                        
                        # Calculate angle
                        angle = calculate_angle(
                            landmarks[p1],
                            landmarks[p2],
                            landmarks[p3]
                        )
                        
                        # Get vertex position for placing the text
                        vertex_x = int(landmarks[p2].x * width)
                        vertex_y = int(landmarks[p2].y * height)
                        
                        # Draw angle at the vertex
                        cv2.putText(black_frame, f"{angle:.1f}°", (vertex_x - 30, vertex_y),
                                  cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 255), 1, cv2.LINE_AA)
                        
                        # Draw angle name and value in the legend
                        cv2.putText(black_frame, f"{angle_name}: {angle:.1f}°", (10, y_offset),
                                  cv2.FONT_HERSHEY_SIMPLEX, 0.2, (0, 255, 255), 1, cv2.LINE_AA)
                        y_offset += 30
                
                # Add frame number
                cv2.putText(black_frame, f"Frame: {frame_count}", (10, 30),
                          cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2, cv2.LINE_AA)
                
                # Write frame
                out.write(black_frame)
            else:
                print(f"No pose detected in frame {frame_count}")
                # Still write the frame even if no pose detected
                cv2.putText(black_frame, f"No pose detected - Frame: {frame_count}", (10, 30),
                          cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2, cv2.LINE_AA)
                out.write(black_frame)
            
            frame_count += 1
            
            # Display progress
            if frame_count % 30 == 0:
                print(f"Processed {frame_count} frames")
    
    # Release resources
    cap.release()
    out.release()
    
    print(f"Processing complete. Processed {frame_count} frames.")
    print(f"Output saved to {output_path}")
    
    return True

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python debug_utils.py <input_video_path> <output_video_path>")
        sys.exit(1)
    
    input_path = sys.argv[1]
    output_path = sys.argv[2]
    
    if not os.path.exists(input_path):
        print(f"Error: Input video not found at {input_path}")
        sys.exit(1)
    
    success = test_skeleton_mode(input_path, output_path)
    if success:
        print("Debug test completed successfully")
    else:
        print("Debug test failed")
        sys.exit(1)