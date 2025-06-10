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
    { day: "Monday", start: "10:30", end: "12:30", task: "HTML/CSS Study", duration: 120, id: "task-mon-1" },
    { day: "Monday", start: "12:30", end: "13:30", task: "Lunch + Leisure", duration: 60, id: "task-mon-2" },
    { day: "Monday", start: "13:30", end: "15:30", task: "Project: Webpage/Interface", duration: 120, id: "task-mon-3" },
    { day: "Monday", start: "15:30", end: "16:00", task: "Short break", duration: 30, id: "task-mon-4" },
    { day: "Monday", start: "16:00", end: "18:00", task: "Practice: CSS/JS", duration: 120, id: "task-mon-5" },
    { day: "Monday", start: "18:00", end: "19:00", task: "Dinner", duration: 60, id: "task-mon-6" },
    { day: "Monday", start: "19:00", end: "21:00", task: "Coursera (Frontend Module)", duration: 120, id: "task-mon-7" },
    { day: "Monday", start: "21:00", end: "23:59", task: "Free time", duration: 179, id: "task-mon-8" },
  ],
  Tuesday: [
    { day: "Tuesday", start: "09:00", end: "10:30", task: "Morning routine", duration: 90, id: "task-tue-0" },
    { day: "Tuesday", start: "10:30", end: "12:30", task: "Django Basics", duration: 120, id: "task-tue-1" },
    { day: "Tuesday", start: "12:30", end: "13:30", task: "Lunch + Leisure", duration: 60, id: "task-tue-2" },
    { day: "Tuesday", start: "13:30", end: "15:30", task: "Coding: Django Project", duration: 120, id: "task-tue-3" },
    { day: "Tuesday", start: "15:30", end: "16:00", task: "Short break", duration: 30, id: "task-tue-4" },
    { day: "Tuesday", start: "16:00", end: "18:00", task: "Continue: Add Functionality", duration: 120, id: "task-tue-5" },
    { day: "Tuesday", start: "18:00", end: "19:00", task: "Dinner", duration: 60, id: "task-tue-6" },
    { day: "Tuesday", start: "19:00", end: "21:00", task: "Assignments/Tutorials", duration: 120, id: "task-tue-7" },
    { day: "Tuesday", start: "21:00", end: "23:59", task: "Free time", duration: 179, id: "task-tue-8" },
  ],
  Wednesday: [
    { day: "Wednesday", start: "09:00", end: "10:30", task: "Morning routine", duration: 90, id: "task-wed-0" },
    { day: "Wednesday", start: "10:30", end: "12:30", task: "Pandas Fundamentals", duration: 120, id: "task-wed-1" },
    { day: "Wednesday", start: "12:30", end: "13:30", task: "Lunch + Leisure", duration: 60, id: "task-wed-2" },
    { day: "Wednesday", start: "13:30", end: "15:30", task: "Data Practice", duration: 120, id: "task-wed-3" },
    { day: "Wednesday", start: "15:30", end: "16:00", task: "Short break", duration: 30, id: "task-wed-4" },
    { day: "Wednesday", start: "16:00", end: "18:00", task: "Data Transformations", duration: 120, id: "task-wed-5" },
    { day: "Wednesday", start: "18:00", end: "19:00", task: "Dinner", duration: 60, id: "task-wed-6" },
    { day: "Wednesday", start: "19:00", end: "21:00", task: "Coursera Challenges", duration: 120, id: "task-wed-7" },
    { day: "Wednesday", start: "21:00", end: "23:59", task: "Free time", duration: 179, id: "task-wed-8" },
  ],
  Thursday: [
    { day: "Thursday", start: "09:00", end: "10:30", task: "Morning routine", duration: 90, id: "task-thu-0" },
    { day: "Thursday", start: "10:30", end: "12:30", task: "Advanced Concepts", duration: 120, id: "task-thu-1" },
    { day: "Thursday", start: "12:30", end: "13:30", task: "Lunch + Leisure", duration: 60, id: "task-thu-2" },
    { day: "Thursday", start: "13:30", end: "15:30", task: "Apply Concepts in Code", duration: 120, id: "task-thu-3" },
    { day: "Thursday", start: "15:30", end: "16:00", task: "Short break", duration: 30, id: "task-thu-4" },
    { day: "Thursday", start: "16:00", end: "18:00", task: "Course Project Work", duration: 120, id: "task-thu-5" },
    { day: "Thursday", start: "18:00", end: "19:00", task: "Dinner", duration: 60, id: "task-thu-6" },
    { day: "Thursday", start: "19:00", end: "21:00", task: "Reinforce Learning", duration: 120, id: "task-thu-7" },
    { day: "Thursday", start: "21:00", end: "23:59", task: "Free time", duration: 179, id: "task-thu-8" },
  ],
  Friday: [
    { day: "Friday", start: "09:00", end: "10:30", task: "Morning routine", duration: 90, id: "task-fri-0" },
    { day: "Friday", start: "10:30", end: "12:30", task: "Project Planning", duration: 120, id: "task-fri-1" },
    { day: "Friday", start: "12:30", end: "13:30", task: "Lunch + Leisure", duration: 60, id: "task-fri-2" },
    { day: "Friday", start: "13:30", end: "15:30", task: "Project: Start Building", duration: 120, id: "task-fri-3" },
    { day: "Friday", start: "15:30", end: "16:00", task: "Short break", duration: 30, id: "task-fri-4" },
    { day: "Friday", start: "16:00", end: "18:00", task: "Features & Fixes", duration: 120, id: "task-fri-5" },
    { day: "Friday", start: "18:00", end: "19:00", task: "Dinner", duration: 60, id: "task-fri-6" },
    { day: "Friday", start: "19:00", end: "21:00", task: "Finalize/Review", duration: 120, id: "task-fri-7" },
    { day: "Friday", start: "21:00", end: "23:59", task: "Free time", duration: 179, id: "task-fri-8" },
  ],
  Saturday: [
    { day: "Saturday", start: "09:00", end: "10:00", task: "Morning routine & Week Review", duration: 60, id: "task-sat-0" },
    { day: "Saturday", start: "10:00", end: "13:00", task: "Extended Project Work", duration: 180, id: "task-sat-1" },
    { day: "Saturday", start: "13:00", end: "14:00", task: "Lunch Break", duration: 60, id: "task-sat-2" },
    { day: "Saturday", start: "14:00", end: "17:00", task: "Skill Deep Dive / New Tech Exploration", duration: 180, id: "task-sat-3" },
    { day: "Saturday", start: "17:00", end: "18:00", task: "Physical Activity / Outdoors", duration: 60, id: "task-sat-4" },
    { day: "Saturday", start: "18:00", end: "23:59", task: "Free time / Social", duration: 359, id: "task-sat-5" },
  ],
  Sunday: [
    { day: "Sunday", start: "00:00", end: "12:59", task: "Rest & Recharge", duration: 779, id: "task-sun-0" },
    { day: "Sunday", start: "13:00", end: "17:00", task: "Plan for Next Week", duration: 240, id: "task-sun-1" },
    { day: "Sunday", start: "17:01", end: "20:59", task: "Relaxing Activities / Hobbies", duration: 238, id: "task-sun-2" },
    { day: "Sunday", start: "21:00", end: "22:00", task: "Prepare for Monday", duration: 60, id: "task-sun-3" },
    { day: "Sunday", start: "22:01", end: "23:59", task: "Rest & Recharge", duration: 118, id: "task-sun-4" }
  ],
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