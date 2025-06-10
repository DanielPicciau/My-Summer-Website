require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cron = require('node-cron');
const fetch = require('node-fetch');
const app = express();

app.use(bodyParser.json());
app.use(express.static('public'));

// Database simulation (in-memory for simplicity)
let taskCompletions = {};
let activityLogs = [];
const notifiedTasks = new Set();

// Schedule data (moved from client)
const scheduleData = {
  Monday: [
    { day: "Monday", start: "09:00", end: "10:30", task: "Morning routine", duration: 90, id: "task-mon-0" },
    // ... (all other tasks from client)
  ],
  // ... (all other days)
};

// Pushover configuration
const PUSHOVER_API_URL = 'https://api.pushover.net/1/messages.json';
const PUSHOVER_USER_KEY = process.env.PUSHOVER_USER_KEY || 'u5cz4j61ut3qz3ehbh4gzo9dnwg423';
const PUSHOVER_API_TOKEN = process.env.PUSHOVER_API_TOKEN || 'acdwyq6voywdmw2dt1dnu4jgjui7jr';

// API Endpoints
app.get('/api/tasks', (req, res) => {
  res.json({ 
    schedule: scheduleData, 
    completions: taskCompletions 
  });
});

app.post('/api/tasks/:taskId/complete', (req, res) => {
  const { taskId } = req.params;
  const { completed } = req.body;
  
  taskCompletions[taskId] = completed;
  
  // Log activity
  activityLogs.push({
    eventType: 'TASK_COMPLETION',
    eventData: { taskId, completed },
    timestamp: new Date().toISOString()
  });
  
  res.json({ success: true });
});

app.post('/api/activity', (req, res) => {
  activityLogs.push({
    eventType: req.body.eventType,
    eventData: req.body.eventData,
    timestamp: new Date().toISOString()
  });
  res.json({ success: true });
});

// Pushover notification function
async function sendPushoverNotification(title, message) {
  try {
    const formData = new URLSearchParams();
    formData.append('token', PUSHOVER_API_TOKEN);
    formData.append('user', PUSHOVER_USER_KEY);
    formData.append('title', title);
    formData.append('message', message);
    formData.append('sound', 'cosmic');
    
    const response = await fetch(PUSHOVER_API_URL, {
      method: 'POST',
      body: formData
    });
    
    const result = await response.json();
    return result.status === 1;
  } catch (error) {
    console.error('Pushover error:', error);
    return false;
  }
}

// Scheduled task checker (runs every minute)
cron.schedule('* * * * *', () => {
  const now = new Date();
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const currentDayName = dayNames[now.getDay()];
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  
  const tasksToday = scheduleData[currentDayName] || [];
  
  tasksToday.forEach(task => {
    const taskStartMinutes = timeToMinutes(task.start);
    const taskEndMinutes = timeToMinutes(task.end);
    
    // Check if task is active now
    if (currentMinutes >= taskStartMinutes && currentMinutes < taskEndMinutes) {
      // Check if we haven't notified for this task today
      const today = now.toDateString();
      const notificationId = `${task.id}-${today}`;
      
      if (!notifiedTasks.has(notificationId)) {
        sendPushoverNotification(
          `Time for: ${task.task}`,
          `From ${task.start} to ${task.end}`
        );
        
        // Log notification
        activityLogs.push({
          eventType: 'NOTIFICATION_SENT',
          eventData: { taskId: task.id, taskName: task.task },
          timestamp: new Date().toISOString()
        });
        
        // Mark as notified
        notifiedTasks.add(notificationId);
      }
    }
  });
  
  // Clean up old notifications (older than 1 day)
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toDateString();
  
  notifiedTasks.forEach(id => {
    if (id.endsWith(yesterdayStr)) {
      notifiedTasks.delete(id);
    }
  });
});

function timeToMinutes(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});