// Global variables
let video;
let canvas;
let ctx;
let poseDetector;
let angleData = [];
let analysisActive = false;
let skeletonMode = false;
let lastFrameTime = 0;
let processingTimes = [];
let framesAnalyzed = 0;
let chart;
let selectedJoint = 'leftElbow';
let maxAngles = {
    leftElbow: { value: 0, time: 0 },
    rightElbow: { value: 0, time: 0 },
    leftShoulder: { value: 0, time: 0 },
    rightShoulder: { value: 0, time: 0 },
    leftKnee: { value: 0, time: 0 },
    rightKnee: { value: 0, time: 0 }
};

// MediaPipe pose landmarks indices
const POSE_LANDMARKS = {
    NOSE: 0,
    LEFT_EYE_INNER: 1,
    LEFT_EYE: 2,
    LEFT_EYE_OUTER: 3,
    RIGHT_EYE_INNER: 4,
    RIGHT_EYE: 5,
    RIGHT_EYE_OUTER: 6,
    LEFT_EAR: 7,
    RIGHT_EAR: 8,
    MOUTH_LEFT: 9,
    MOUTH_RIGHT: 10,
    LEFT_SHOULDER: 11,
    RIGHT_SHOULDER: 12,
    LEFT_ELBOW: 13,
    RIGHT_ELBOW: 14,
    LEFT_WRIST: 15,
    RIGHT_WRIST: 16,
    LEFT_PINKY: 17,
    RIGHT_PINKY: 18,
    LEFT_INDEX: 19,
    RIGHT_INDEX: 20,
    LEFT_THUMB: 21,
    RIGHT_THUMB: 22,
    LEFT_HIP: 23,
    RIGHT_HIP: 24,
    LEFT_KNEE: 25,
    RIGHT_KNEE: 26,
    LEFT_ANKLE: 27,
    RIGHT_ANKLE: 28,
    LEFT_HEEL: 29,
    RIGHT_HEEL: 30,
    LEFT_FOOT_INDEX: 31,
    RIGHT_FOOT_INDEX: 32
};

// DOM elements
document.addEventListener('DOMContentLoaded', () => {
    // Initialize elements
    video = document.getElementById('videoPlayer');
    canvas = document.getElementById('overlayCanvas');
    ctx = canvas.getContext('2d');
    
    // Set up event listeners
    setupEventListeners();
    
    // Initialize Chart.js
    initializeChart();
    
    // Load MediaPipe
    loadMediaPipe();
});

// Load MediaPipe Pose model
async function loadMediaPipe() {
    try {
        // Import MediaPipe libraries
        const { createDetector, SupportedModels } = window.poseDetection;
        
        // Create pose detector with BlazePose model
        poseDetector = await createDetector(SupportedModels.BlazePose, {
            runtime: 'mediapipe',
            modelType: 'full',
            solutionPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/pose',
            enableSmoothing: true
        });
        
        showNotification('MediaPipe loaded successfully', 'success');
    } catch (error) {
        console.error('Failed to load MediaPipe:', error);
        showNotification('Failed to load MediaPipe. Please check your internet connection.', 'error');
    }
}

// Set up all event listeners
function setupEventListeners() {
    // Video upload
    const dropZone = document.getElementById('dropZone');
    const videoUpload = document.getElementById('videoUpload');
    
    dropZone.addEventListener('click', () => videoUpload.click());
    
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragging');
    });
    
    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragging');
    });
    
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragging');
        
        if (e.dataTransfer.files.length) {
            handleVideoFile(e.dataTransfer.files[0]);
        }
    });
    
    videoUpload.addEventListener('change', (e) => {
        if (e.target.files.length) {
            handleVideoFile(e.target.files[0]);
        }
    });
    
    // Video controls
    const playPauseBtn = document.getElementById('playPauseBtn');
    const videoProgress = document.getElementById('videoProgress');
    
    playPauseBtn.addEventListener('click', togglePlayPause);
    
    video.addEventListener('play', () => {
        const playIcon = playPauseBtn.querySelector('.play-icon');
        const pauseIcon = playPauseBtn.querySelector('.pause-icon');
        playIcon.classList.add('hidden');
        pauseIcon.classList.remove('hidden');
    });
    
    video.addEventListener('pause', () => {
        const playIcon = playPauseBtn.querySelector('.play-icon');
        const pauseIcon = playPauseBtn.querySelector('.pause-icon');
        playIcon.classList.remove('hidden');
        pauseIcon.classList.add('hidden');
    });
    
    video.addEventListener('timeupdate', updateVideoProgress);
    
    videoProgress.addEventListener('input', () => {
        const seekTime = (videoProgress.value / 100) * video.duration;
        video.currentTime = seekTime;
    });
    
    // Analysis controls
    const startAnalysisBtn = document.getElementById('startAnalysisBtn');
    const resetBtn = document.getElementById('resetBtn');
    const downloadDataBtn = document.getElementById('downloadDataBtn');
    const skeletonModeToggle = document.getElementById('skeletonMode');
    
    startAnalysisBtn.addEventListener('click', toggleAnalysis);
    resetBtn.addEventListener('click', resetAnalysis);
    downloadDataBtn.addEventListener('click', downloadData);
    skeletonModeToggle.addEventListener('change', () => {
        skeletonMode = skeletonModeToggle.checked;
    });
    
    // Tab navigation
    const tabButtons = document.querySelectorAll('.tab-btn');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.getAttribute('data-tab');
            switchTab(targetTab);
        });
    });
    
    // Joint selection
    const jointSelect = document.getElementById('jointSelect');
    const chartJointSelect = document.getElementById('chartJointSelect');
    
    jointSelect.addEventListener('change', () => {
        filterDataTable(jointSelect.value);
    });
    
    chartJointSelect.addEventListener('change', () => {
        selectedJoint = chartJointSelect.value;
        updateChart();
    });
}

// Handle video file upload
function handleVideoFile(file) {
    if (!file.type.startsWith('video/')) {
        showNotification('Please upload a valid video file', 'error');
        return;
    }
    
    const url = URL.createObjectURL(file);
    
    // Set video source
    video.src = url;
    
    // Show analysis section
    document.getElementById('analysisSection').classList.remove('hidden');
    
    // Set up canvas size when video metadata is loaded
    video.addEventListener('loadedmetadata', () => {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        resetAnalysis();
        showNotification('Video loaded successfully', 'success');
    });
}

// Toggle play/pause
function togglePlayPause() {
    if (video.paused) {
        video.play();
    } else {
        video.pause();
    }
}

// Update video progress and time display
function updateVideoProgress() {
    const progress = (video.currentTime / video.duration) * 100;
    const timeDisplay = document.getElementById('timeDisplay');
    
    document.getElementById('videoProgress').value = progress;
    
    // Format time display (MM:SS / MM:SS)
    const currentMinutes = Math.floor(video.currentTime / 60);
    const currentSeconds = Math.floor(video.currentTime % 60);
    const totalMinutes = Math.floor(video.duration / 60);
    const totalSeconds = Math.floor(video.duration % 60);
    
    timeDisplay.textContent = `${String(currentMinutes).padStart(2, '0')}:${String(currentSeconds).padStart(2, '0')} / ${String(totalMinutes).padStart(2, '0')}:${String(totalSeconds).padStart(2, '0')}`;
    
    // Process frame for pose detection if analysis is active
    if (analysisActive && !video.paused) {
        processFrame();
    }
}

// Toggle analysis
function toggleAnalysis() {
    const startAnalysisBtn = document.getElementById('startAnalysisBtn');
    
    if (analysisActive) {
        // Stop analysis
        analysisActive = false;
        startAnalysisBtn.textContent = 'Start Analysis';
        startAnalysisBtn.classList.remove('danger');
    } else {
        // Start analysis
        if (!poseDetector) {
            showNotification('MediaPipe is not loaded yet. Please wait.', 'warning');
            return;
        }
        
        analysisActive = true;
        startAnalysisBtn.textContent = 'Stop Analysis';
        startAnalysisBtn.classList.add('danger');
        
        // Start processing frames
        if (video.paused) {
            video.play();
        }
        
        processFrame();
    }
}

// Process a single video frame
async function processFrame() {
    if (!analysisActive) return;
    
    const startTime = performance.now();
    
    try {
        // Detect poses in the current frame
        const poses = await poseDetector.estimatePoses(video);
        
        if (poses.length > 0) {
            const pose = poses[0]; // We only care about the first detected person
            
            // Draw the skeleton
            drawSkeleton(pose);
            
            // Calculate joint angles
            const angles = calculateJointAngles(pose);
            
            // Update data
            updateAngleData(angles);
            
            // Calculate processing time
            const endTime = performance.now();
            const processingTime = endTime - startTime;
            processingTimes.push(processingTime);
            framesAnalyzed++;
            
            // Update session statistics
            updateSessionStats();
        }
    } catch (error) {
        console.error('Error processing frame:', error);
    }
    
    // Request next frame if analysis is still active
    if (analysisActive && !video.paused) {
        requestAnimationFrame(processFrame);
    }
}

// Draw skeleton on canvas
function drawSkeleton(pose) {
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Apply skeleton mode effect
    if (skeletonMode) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    
    const keypoints = pose.keypoints;
    
    // Draw connection lines
    drawConnections(keypoints);
    
    // Draw keypoints
    keypoints.forEach(keypoint => {
        if (keypoint.score > 0.5) {
            ctx.beginPath();
            ctx.arc(
                keypoint.x * canvas.width,
                keypoint.y * canvas.height,
                6,
                0,
                2 * Math.PI
            );
            ctx.fillStyle = 'rgba(52, 152, 219, 0.8)';
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = 'white';
            ctx.stroke();
        }
    });
    
    // Draw joint angles
    drawJointAngles(keypoints);
}

// Draw connections between keypoints
function drawConnections(keypoints) {
    const connections = [
        // Torso
        [POSE_LANDMARKS.LEFT_SHOULDER, POSE_LANDMARKS.RIGHT_SHOULDER],
        [POSE_LANDMARKS.LEFT_SHOULDER, POSE_LANDMARKS.LEFT_HIP],
        [POSE_LANDMARKS.RIGHT_SHOULDER, POSE_LANDMARKS.RIGHT_HIP],
        [POSE_LANDMARKS.LEFT_HIP, POSE_LANDMARKS.RIGHT_HIP],
        
        // Left arm
        [POSE_LANDMARKS.LEFT_SHOULDER, POSE_LANDMARKS.LEFT_ELBOW],
        [POSE_LANDMARKS.LEFT_ELBOW, POSE_LANDMARKS.LEFT_WRIST],
        [POSE_LANDMARKS.LEFT_WRIST, POSE_LANDMARKS.LEFT_INDEX],
        
        // Right arm
        [POSE_LANDMARKS.RIGHT_SHOULDER, POSE_LANDMARKS.RIGHT_ELBOW],
        [POSE_LANDMARKS.RIGHT_ELBOW, POSE_LANDMARKS.RIGHT_WRIST],
        [POSE_LANDMARKS.RIGHT_WRIST, POSE_LANDMARKS.RIGHT_INDEX],
        
        // Left leg
        [POSE_LANDMARKS.LEFT_HIP, POSE_LANDMARKS.LEFT_KNEE],
        [POSE_LANDMARKS.LEFT_KNEE, POSE_LANDMARKS.LEFT_ANKLE],
        [POSE_LANDMARKS.LEFT_ANKLE, POSE_LANDMARKS.LEFT_FOOT_INDEX],
        
        // Right leg
        [POSE_LANDMARKS.RIGHT_HIP, POSE_LANDMARKS.RIGHT_KNEE],
        [POSE_LANDMARKS.RIGHT_KNEE, POSE_LANDMARKS.RIGHT_ANKLE],
        [POSE_LANDMARKS.RIGHT_ANKLE, POSE_LANDMARKS.RIGHT_FOOT_INDEX]
    ];
    
    connections.forEach(([start, end]) => {
        const startPoint = keypoints[start];
        const endPoint = keypoints[end];
        
        if (startPoint && endPoint && startPoint.score > 0.5 && endPoint.score > 0.5) {
            ctx.beginPath();
            ctx.moveTo(startPoint.x * canvas.width, startPoint.y * canvas.height);
            ctx.lineTo(endPoint.x * canvas.width, endPoint.y * canvas.height);
            ctx.lineWidth = 4;
            ctx.strokeStyle = 'rgba(46, 204, 113, 0.8)';
            ctx.stroke();
        }
    });
}

// Draw calculated joint angles on canvas
function drawJointAngles(keypoints) {
    // Left elbow angle
    drawAngle(
        keypoints[POSE_LANDMARKS.LEFT_SHOULDER],
        keypoints[POSE_LANDMARKS.LEFT_ELBOW],
        keypoints[POSE_LANDMARKS.LEFT_WRIST],
        'Left Elbow'
    );
    
    // Right elbow angle
    drawAngle(
        keypoints[POSE_LANDMARKS.RIGHT_SHOULDER],
        keypoints[POSE_LANDMARKS.RIGHT_ELBOW],
        keypoints[POSE_LANDMARKS.RIGHT_WRIST],
        'Right Elbow'
    );
    
    // Left shoulder angle
    drawAngle(
        keypoints[POSE_LANDMARKS.LEFT_HIP],
        keypoints[POSE_LANDMARKS.LEFT_SHOULDER],
        keypoints[POSE_LANDMARKS.LEFT_ELBOW],
        'Left Shoulder'
    );
    
    // Right shoulder angle
    drawAngle(
        keypoints[POSE_LANDMARKS.RIGHT_HIP],
        keypoints[POSE_LANDMARKS.RIGHT_SHOULDER],
        keypoints[POSE_LANDMARKS.RIGHT_ELBOW],
        'Right Shoulder'
    );
    
    // Left knee angle
    drawAngle(
        keypoints[POSE_LANDMARKS.LEFT_HIP],
        keypoints[POSE_LANDMARKS.LEFT_KNEE],
        keypoints[POSE_LANDMARKS.LEFT_ANKLE],
        'Left Knee'
    );
    
    // Right knee angle
    drawAngle(
        keypoints[POSE_LANDMARKS.RIGHT_HIP],
        keypoints[POSE_LANDMARKS.RIGHT_KNEE],
        keypoints[POSE_LANDMARKS.RIGHT_ANKLE],
        'Right Knee'
    );
}

// Draw a specific angle
function drawAngle(pointA, pointB, pointC, label) {
    if (pointA && pointB && pointC && 
        pointA.score > 0.5 && pointB.score > 0.5 && pointC.score > 0.5) {
        
        const angle = calculateAngle(
            pointA.x, pointA.y,
            pointB.x, pointB.y,
            pointC.x, pointC.y
        );
        
        // Draw angle arc
        ctx.beginPath();
        ctx.arc(
            pointB.x * canvas.width,
            pointB.y * canvas.height,
            20,
            Math.atan2(pointA.y - pointB.y, pointA.x - pointB.x),
            Math.atan2(pointC.y - pointB.y, pointC.x - pointB.x)
        );
        ctx.strokeStyle = 'rgba(231, 76, 60, 0.8)';
        ctx.lineWidth = 3;
        ctx.stroke();
        
        // Draw angle value
        ctx.font = '16px Arial';
        ctx.fillStyle = 'white';
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 3;
        ctx.strokeText(
            `${Math.round(angle)}°`,
            pointB.x * canvas.width + 10,
            pointB.y * canvas.height - 10
        );
        ctx.fillText(
            `${Math.round(angle)}°`,
            pointB.x * canvas.width + 10,
            pointB.y * canvas.height - 10
        );
    }
}

// Calculate angle between three points
function calculateAngle(x1, y1, x2, y2, x3, y3) {
    // Calculate vectors
    const vector1 = { x: x1 - x2, y: y1 - y2 };
    const vector2 = { x: x3 - x2, y: y3 - y2 };
    
    // Calculate dot product
    const dotProduct = vector1.x * vector2.x + vector1.y * vector2.y;
    
    // Calculate magnitudes
    const magnitude1 = Math.sqrt(vector1.x * vector1.x + vector1.y * vector1.y);
    const magnitude2 = Math.sqrt(vector2.x * vector2.x + vector2.y * vector2.y);
    
    // Calculate angle in radians
    const angleRad = Math.acos(dotProduct / (magnitude1 * magnitude2));
    
    // Convert to degrees
    const angleDeg = angleRad * (180 / Math.PI);
    
    return angleDeg;
}

// Calculate all joint angles from pose
function calculateJointAngles(pose) {
    const keypoints = pose.keypoints;
    
    // Check if we have the required keypoints with good confidence
    const leftElbowAngle = keypoints[POSE_LANDMARKS.LEFT_SHOULDER].score > 0.5 &&
                         keypoints[POSE_LANDMARKS.LEFT_ELBOW].score > 0.5 &&
                         keypoints[POSE_LANDMARKS.LEFT_WRIST].score > 0.5
        ? calculateAngle(
            keypoints[POSE_LANDMARKS.LEFT_SHOULDER].x, keypoints[POSE_LANDMARKS.LEFT_SHOULDER].y,
            keypoints[POSE_LANDMARKS.LEFT_ELBOW].x, keypoints[POSE_LANDMARKS.LEFT_ELBOW].y,
            keypoints[POSE_LANDMARKS.LEFT_WRIST].x, keypoints[POSE_LANDMARKS.LEFT_WRIST].y
        )
        : null;
    
    const rightElbowAngle = keypoints[POSE_LANDMARKS.RIGHT_SHOULDER].score > 0.5 &&
                          keypoints[POSE_LANDMARKS.RIGHT_ELBOW].score > 0.5 &&
                          keypoints[POSE_LANDMARKS.RIGHT_WRIST].score > 0.5
        ? calculateAngle(
            keypoints[POSE_LANDMARKS.RIGHT_SHOULDER].x, keypoints[POSE_LANDMARKS.RIGHT_SHOULDER].y,
            keypoints[POSE_LANDMARKS.RIGHT_ELBOW].x, keypoints[POSE_LANDMARKS.RIGHT_ELBOW].y,
            keypoints[POSE_LANDMARKS.RIGHT_WRIST].x, keypoints[POSE_LANDMARKS.RIGHT_WRIST].y
        )
        : null;
    
    const leftShoulderAngle = keypoints[POSE_LANDMARKS.LEFT_HIP].score > 0.5 &&
                            keypoints[POSE_LANDMARKS.LEFT_SHOULDER].score > 0.5 &&
                            keypoints[POSE_LANDMARKS.LEFT_ELBOW].score > 0.5
        ? calculateAngle(
            keypoints[POSE_LANDMARKS.LEFT_HIP].x, keypoints[POSE_LANDMARKS.LEFT_HIP].y,
            keypoints[POSE_LANDMARKS.LEFT_SHOULDER].x, keypoints[POSE_LANDMARKS.LEFT_SHOULDER].y,
            keypoints[POSE_LANDMARKS.LEFT_ELBOW].x, keypoints[POSE_LANDMARKS.LEFT_ELBOW].y
        )
        : null;
    
    const rightShoulderAngle = keypoints[POSE_LANDMARKS.RIGHT_HIP].score > 0.5 &&
                             keypoints[POSE_LANDMARKS.RIGHT_SHOULDER].score > 0.5 &&
                             keypoints[POSE_LANDMARKS.RIGHT_ELBOW].score > 0.5
        ? calculateAngle(
            keypoints[POSE_LANDMARKS.RIGHT_HIP].x, keypoints[POSE_LANDMARKS.RIGHT_HIP].y,
            keypoints[POSE_LANDMARKS.RIGHT_SHOULDER].x, keypoints[POSE_LANDMARKS.RIGHT_SHOULDER].y,
            keypoints[POSE_LANDMARKS.RIGHT_ELBOW].x, keypoints[POSE_LANDMARKS.RIGHT_ELBOW].y
        )
        : null;
    
    const leftKneeAngle = keypoints[POSE_LANDMARKS.LEFT_HIP].score > 0.5 &&
                        keypoints[POSE_LANDMARKS.LEFT_KNEE].score > 0.5 &&
                        keypoints[POSE_LANDMARKS.LEFT_ANKLE].score > 0.5
        ? calculateAngle(
            keypoints[POSE_LANDMARKS.LEFT_HIP].x, keypoints[POSE_LANDMARKS.LEFT_HIP].y,
            keypoints[POSE_LANDMARKS.LEFT_KNEE].x, keypoints[POSE_LANDMARKS.LEFT_KNEE].y,
            keypoints[POSE_LANDMARKS.LEFT_ANKLE].x, keypoints[POSE_LANDMARKS.LEFT_ANKLE].y
        )
        : null;
    
    const rightKneeAngle = keypoints[POSE_LANDMARKS.RIGHT_HIP].score > 0.5 &&
                         keypoints[POSE_LANDMARKS.RIGHT_KNEE].score > 0.5 &&
                         keypoints[POSE_LANDMARKS.RIGHT_ANKLE].score > 0.5
        ? calculateAngle(
            keypoints[POSE_LANDMARKS.RIGHT_HIP].x, keypoints[POSE_LANDMARKS.RIGHT_HIP].y,
            keypoints[POSE_LANDMARKS.RIGHT_KNEE].x, keypoints[POSE_LANDMARKS.RIGHT_KNEE].y,
            keypoints[POSE_LANDMARKS.RIGHT_ANKLE].x, keypoints[POSE_LANDMARKS.RIGHT_ANKLE].y
        )
        : null;
    
    return {
        time: video.currentTime,
        leftElbow: leftElbowAngle,
        rightElbow: rightElbowAngle,
        leftShoulder: leftShoulderAngle,
        rightShoulder: rightShoulderAngle,
        leftKnee: leftKneeAngle,
        rightKnee: rightKneeAngle
    };
}

// Update angle data with new measurements
function updateAngleData(angles) {
    // Add data to array
    angleData.push(angles);
    
    // Update data table
    updateDataTable(angles);
    
    // Update chart
    updateChart();
    
    // Update max angles
    updateMaxAngles(angles);
}

// Update data table with new measurements
function updateDataTable(angles) {
    const tableBody = document.getElementById('angleDataBody');
    
    // Create a new row
    const row = document.createElement('tr');
    
    // Format time as MM:SS.ms
    const minutes = Math.floor(angles.time / 60);
    const seconds = Math.floor(angles.time % 60);
    const milliseconds = Math.floor((angles.time % 1) * 1000);
    const timeFormatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`;
    
    // Add cells to row
    row.innerHTML = `
        <td>${timeFormatted}</td>
        <td>${angles.leftElbow ? angles.leftElbow.toFixed(1) : 'N/A'}</td>
        <td>${angles.rightElbow ? angles.rightElbow.toFixed(1) : 'N/A'}</td>
        <td>${angles.leftShoulder ? angles.leftShoulder.toFixed(1) : 'N/A'}</td>
        <td>${angles.rightShoulder ? angles.rightShoulder.toFixed(1) : 'N/A'}</td>
        <td>${angles.leftKnee ? angles.leftKnee.toFixed(1) : 'N/A'}</td>
        <td>${angles.rightKnee ? angles.rightKnee.toFixed(1) : 'N/A'}</td>
    `;
    
    // Add row to table
    tableBody.appendChild(row);
    
    // Filter based on current selection
    const jointSelect = document.getElementById('jointSelect');
    filterDataTable(jointSelect.value);
}

// Filter data table to show only selected joint
function filterDataTable(jointType) {
    const tableRows = document.querySelectorAll('#angleDataTable tbody tr');
    const tableHeaders = document.querySelectorAll('#angleDataTable th');
    
    if (jointType === 'all') {
        // Show all columns
        tableHeaders.forEach((header, index) => {
            if (index > 0) header.classList.remove('hidden');
        });
        
        tableRows.forEach(row => {
            const cells = row.querySelectorAll('td');
            cells.forEach((cell, index) => {
                if (index > 0) cell.classList.remove('hidden');
            });
        });
    } else {
        // Get the index of the selected joint column
        let selectedIndex = 0;
        const jointNames = ['leftElbow', 'rightElbow', 'leftShoulder', 'rightShoulder', 'leftKnee', 'rightKnee'];
        selectedIndex = jointNames.indexOf(jointType) + 1; // +1 because first column is time
        
        // Hide all columns except time and selected joint
        tableHeaders.forEach((header, index) => {
            if (index > 0 && index !== selectedIndex) {
                header.classList.add('hidden');
            } else {
                header.classList.remove('hidden');
            }
        });
        
        tableRows.forEach(row => {
            const cells = row.querySelectorAll('td');
            cells.forEach((cell, index) => {
                if (index > 0 && index !== selectedIndex) {
                    cell.classList.add('hidden');
                } else {
                    cell.classList.remove('hidden');
                }
            });
        });
    }
}

// Initialize Chart.js chart
function initializeChart() {
    const ctx = document.getElementById('angleChart').getContext('2d');
    
    chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [], // Time values
            datasets: [{
                label: 'Angle (degrees)',
                data: [], // Angle values
                backgroundColor: 'rgba(52, 152, 219, 0.2)',
                borderColor: 'rgba(52, 152, 219, 1)',
                borderWidth: 2,
                pointBackgroundColor: 'rgba(52, 152, 219, 1)',
                pointBorderColor: '#fff',
                pointRadius: 4,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Time (seconds)'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Angle (degrees)'
                    },
                    min: 0,
                    max: 180
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: 'Joint Angle over Time',
                    font: {
                        size: 16
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `Angle: ${context.parsed.y.toFixed(1)}°`;
                        }
                    }
                }
            }
        }
    });
}

// Update chart with new data
function updateChart() {
    if (!chart || angleData.length === 0) return;
    
    const timeData = angleData.map(data => data.time.toFixed(1));
    const angleValues = angleData.map(data => data[selectedJoint]);
    
    chart.data.labels = timeData;
    chart.data.datasets[0].data = angleValues;
    chart.data.datasets[0].label = `${selectedJoint} Angle (degrees)`;
    
    // Update chart title
    const displayName = selectedJoint.replace(/([A-Z])/g, ' $1')
        .replace(/^./, function(str) { return str.toUpperCase(); });
    
    chart.options.plugins.title.text = `${displayName} Angle over Time`;
    
    chart.update();
}

// Update maximum angles and summary display
function updateMaxAngles(angles) {
    // Update max angles
    Object.keys(maxAngles).forEach(joint => {
        if (angles[joint] && (angles[joint] > maxAngles[joint].value || maxAngles[joint].value === 0)) {
            maxAngles[joint] = {
                value: angles[joint],
                time: angles.time
            };
            
            // Update summary display
            const maxCard = document.getElementById(`${joint}Max`);
            if (maxCard) {
                const angleValue = maxCard.querySelector('.angle-value');
                const timestamp = maxCard.querySelector('.timestamp');
                
                angleValue.textContent = `${maxAngles[joint].value.toFixed(1)}°`;
                
                // Format time for display
                const minutes = Math.floor(maxAngles[joint].time / 60);
                const seconds = Math.floor(maxAngles[joint].time % 60);
                timestamp.textContent = `Time: ${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
            }
        }
    });
}

// Update session statistics
function updateSessionStats() {
    // Calculate average processing time
    const avgProcessingTime = processingTimes.reduce((acc, time) => acc + time, 0) / processingTimes.length;
    
    // Format analysis duration
    const durationSeconds = video.currentTime;
    const minutes = Math.floor(durationSeconds / 60);
    const seconds = Math.floor(durationSeconds % 60);
    const formattedDuration = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    
    // Update display
    document.getElementById('analysisDuration').textContent = formattedDuration;
    document.getElementById('framesAnalyzed').textContent = framesAnalyzed;
    document.getElementById('avgProcessingTime').textContent = `${avgProcessingTime.toFixed(1)} ms`;
}

// Reset analysis
function resetAnalysis() {
    // Reset data
    angleData = [];
    framesAnalyzed = 0;
    processingTimes = [];
    
    // Reset max angles
    Object.keys(maxAngles).forEach(joint => {
        maxAngles[joint] = { value: 0, time: 0 };
        
        // Reset summary display
        const maxCard = document.getElementById(`${joint}Max`);
        if (maxCard) {
            const angleValue = maxCard.querySelector('.angle-value');
            const timestamp = maxCard.querySelector('.timestamp');
            
            angleValue.textContent = '--°';
            timestamp.textContent = 'Time: --:--';
        }
    });
    
    // Reset data table
    document.getElementById('angleDataBody').innerHTML = '';
    
    // Reset chart
    if (chart) {
        chart.data.labels = [];
        chart.data.datasets[0].data = [];
        chart.update();
    }
    
    // Reset session stats
    document.getElementById('analysisDuration').textContent = '--:--';
    document.getElementById('framesAnalyzed').textContent = '0';
    document.getElementById('avgProcessingTime').textContent = '-- ms';
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Reset analysis state
    if (analysisActive) {
        analysisActive = false;
        const startAnalysisBtn = document.getElementById('startAnalysisBtn');
        startAnalysisBtn.textContent = 'Start Analysis';
        startAnalysisBtn.classList.remove('danger');
    }
    
    showNotification('Analysis reset successfully', 'success');
}

// Download data as CSV
function downloadData() {
    if (angleData.length === 0) {
        showNotification('No data available to download', 'warning');
        return;
    }
    
    // Create CSV content
    let csvContent = 'Time,Left Elbow,Right Elbow,Left Shoulder,Right Shoulder,Left Knee,Right Knee\n';
    
    angleData.forEach(data => {
        csvContent += `${data.time},`;
        csvContent += `${data.leftElbow ? data.leftElbow.toFixed(1) : ''},`;
        csvContent += `${data.rightElbow ? data.rightElbow.toFixed(1) : ''},`;
        csvContent += `${data.leftShoulder ? data.leftShoulder.toFixed(1) : ''},`;
        csvContent += `${data.rightShoulder ? data.rightShoulder.toFixed(1) : ''},`;
        csvContent += `${data.leftKnee ? data.leftKnee.toFixed(1) : ''},`;
        csvContent += `${data.rightKnee ? data.rightKnee.toFixed(1) : ''}\n`;
    });
    
    // Create and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    
    // Generate filename with timestamp
    const date = new Date();
    const timestamp = `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}_${date.getHours().toString().padStart(2, '0')}${date.getMinutes().toString().padStart(2, '0')}`;
    const filename = `joint_angle_data_${timestamp}.csv`;
    
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    showNotification('Data downloaded successfully', 'success');
}

// Switch between tabs
function switchTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-pane').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Deactivate all tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Activate selected tab
    document.getElementById(`${tabName}Tab`).classList.add('active');
    
    // Activate selected tab button
    document.querySelector(`.tab-btn[data-tab="${tabName}"]`).classList.add('active');
    
    // Additional actions for specific tabs
    if (tabName === 'chart') {
        // Update chart when switching to chart tab
        updateChart();
    }
}

// Display notification
function showNotification(message, type = 'success') {
    const notification = document.getElementById('notification');
    const notificationMessage = document.getElementById('notificationMessage');
    
    // Set message and type
    notificationMessage.textContent = message;
    notification.className = 'notification';
    notification.classList.add(type);
    
    // Show notification
    notification.classList.add('show');
    
    // Hide after 3 seconds
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

// Show/hide loading overlay
function toggleLoadingOverlay(show, message = 'Processing video...') {
    const loadingOverlay = document.getElementById('loadingOverlay');
    const loadingMessage = loadingOverlay.querySelector('p');
    
    loadingMessage.textContent = message;
    
    if (show) {
        loadingOverlay.classList.remove('hidden');
    } else {
        loadingOverlay.classList.add('hidden');
    }
}