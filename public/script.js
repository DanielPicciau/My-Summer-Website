// Pushover Configuration
const PUSHOVER_API_URL = 'https://api.pushover.net/1/messages.json';
let pushoverUserKey = 'u5cz4j61ut3qz3ehbh4gzo9dnwg423';
let pushoverApiToken = 'acdwyq6voywdmw2dt1dnu4jgjui7jr';
let lastNotifiedTaskId = null;

// Notification System
const notification = {
  element: document.getElementById('notification'),
  title: document.getElementById('notification-title'),
  message: document.getElementById('notification-message'),
  closeBtn: document.querySelector('.notification-close'),
  
  init: function() {
    this.closeBtn.addEventListener('click', () => this.hide());
  },
  
  show: function(title, message, duration = 5000) {
    this.title.textContent = title;
    this.message.textContent = message;
    this.element.classList.add('show');
    
    if (duration > 0) {
      setTimeout(() => this.hide(), duration);
    }
  },
  
  hide: function() {
    this.element.classList.remove('show');
  }
};

// Pushover Notification Function
async function sendPushoverNotification(title, message) {
  try {
    const formData = new FormData();
    formData.append('token', pushoverApiToken);
    formData.append('user', pushoverUserKey);
    formData.append('title', title);
    formData.append('message', message);
    formData.append('sound', 'cosmic');

    const response = await fetch(PUSHOVER_API_URL, {
      method: 'POST',
      body: formData
    });

    const result = await response.json();

    if (result.status === 1) {
      notification.show('Notification Sent', 'Mobile notification has been delivered!');
      return true;
    } else {
      notification.show('Error', `Failed to send notification: ${result.errors?.join(', ') || 'Unknown error'}`);
      return false;
    }
  } catch (error) {
    notification.show('Error', `Failed to send notification: ${error.message}`);
    return false;
  }
}

// Initialize notification system
notification.init();

// DOM Elements
const liveClockEl = document.getElementById('live-clock');
const todayFocusDayEl = document.getElementById('today-focus-day');
const todayFocusDateEl = document.getElementById('today-focus-date');
const todayFocusTimeEl = document.getElementById('today-focus-time');
const todayFocusCurrentTaskEl = document.getElementById('today-focus-current-task');
const todayFocusProgressFill = document.getElementById('today-focus-progress-fill');
const todayFocusUpcomingTasksEl = document.getElementById('today-focus-upcoming-tasks');
const missedHoursSummaryEl = document.getElementById('missed-hours-summary');
const missedHoursImpactEl = document.getElementById('missed-hours-impact');
const savePushoverBtn = document.getElementById('save-pushover');
const testNotificationBtn = document.getElementById('test-notification');

let currentlyHighlighted = null;
let scheduleData = {}; // Will be populated from server

// Save Pushover configuration
if (savePushoverBtn) {
  savePushoverBtn.addEventListener('click', () => {
    pushoverUserKey = document.getElementById('pushover-user').value;
    pushoverApiToken = document.getElementById('pushover-token').value;

    localStorage.setItem('pushoverUserKey', pushoverUserKey);
    localStorage.setItem('pushoverApiToken', pushoverApiToken);

    notification.show('Configuration Saved', 'Pushover settings have been updated successfully!');
  });
}

// Test notification
if (testNotificationBtn) {
  testNotificationBtn.addEventListener('click', async () => {
    notification.show('Sending Test', 'Sending test notification to your mobile...');
    await sendPushoverNotification(
      'Schedule Notification Test',
      'This is a test notification from your summer schedule app!'
    );
  });
}

// Fetch schedule data from server
async function fetchScheduleData() {
  try {
    const response = await fetch('/api/tasks');
    const data = await response.json();
    scheduleData = data.schedule;
    return data.completions;
  } catch (error) {
    console.error('Error fetching schedule data:', error);
    return {};
  }
}

function timeToMinutes(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

function updateLiveClock() {
  const now = new Date();
  const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  liveClockEl.textContent = timeString;
  todayFocusTimeEl.textContent = timeString;
}

async function saveTaskCompletion(taskId, isCompleted) {
  try {
    await fetch(`/api/tasks/${taskId}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: isCompleted })
    });
  } catch (error) {
    console.error('Error saving task completion:', error);
  }
  updateMissedHoursSummary();
}

function renderTasksForDay(dayName, tasks, completions) {
  const ulElement = document.getElementById(`${dayName.toLowerCase()}-tasks`);
  if (!ulElement) return;

  ulElement.innerHTML = '';

  tasks.forEach(task => {
    const isCompleted = completions[task.id] || false;

    const li = document.createElement('li');
    li.id = task.id;
    li.className = `p-2 rounded-lg flex items-start gap-2 ${isCompleted ? 'task-completed' : ''}`;

    li.innerHTML = `
      <input type="checkbox" class="task-checkbox mt-1" id="checkbox-${task.id}" ${isCompleted ? 'checked' : ''}>
      <div class="flex-1">
        <div class="flex justify-between items-center">
          <strong class="text-slate-100">${task.start}–${task.end}</strong>
          <span class="text-xs text-slate-500">${task.duration} min</span>
        </div>
        <div class="text-slate-300">${task.task}</div>
      </div>
    `;
    
    ulElement.appendChild(li);

    const checkbox = document.getElementById(`checkbox-${task.id}`);
    if (checkbox) {
        checkbox.addEventListener('change', (event) => {
            saveTaskCompletion(task.id, event.target.checked);
            if (event.target.checked) {
                li.classList.add('task-completed');
            } else {
                li.classList.remove('task-completed');
            }
        });
    }
  });
}

async function calculateMissedHours() {
  let missedMinutes = 0;
  const now = new Date();
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const currentDayIndex = now.getDay();
  const currentMinutesOfDay = now.getHours() * 60 + now.getMinutes();

  // Get completions from server
  const completions = await fetchScheduleData();

  for (let i = 0; i < dayNames.length; i++) {
    const dayName = dayNames[i];
    const dayTasks = scheduleData[dayName];
    if (!dayTasks) continue;

    if (i < currentDayIndex) {
      dayTasks.forEach(task => {
        if (task.task.toLowerCase().includes("free time") || 
            task.task.toLowerCase().includes("leisure") || 
            task.duration === undefined) {
          return; 
        }
        const isCompleted = completions[task.id] || false;
        if (!isCompleted) {
          missedMinutes += task.duration;
        }
      });
    } else if (i === currentDayIndex) {
      dayTasks.forEach(task => {
        const taskEndMinutes = timeToMinutes(task.end);
        if (taskEndMinutes <= currentMinutesOfDay) {
          if (task.task.toLowerCase().includes("free time") || 
              task.task.toLowerCase().includes("leisure") || 
              task.duration === undefined) {
            return; 
          }
          const isCompleted = completions[task.id] || false;
          if (!isCompleted) {
            missedMinutes += task.duration;
          }
        }
      });
    }
  }
  return missedMinutes;
}

async function updateMissedHoursSummary() {
  const totalMissedMinutes = await calculateMissedHours();
  const missedHours = Math.floor(totalMissedMinutes / 60);
  const remainingMinutes = totalMissedMinutes % 60;

  if (totalMissedMinutes === 0) {
    missedHoursSummaryEl.textContent = "You haven't missed any study time! Keep up the great work.";
    missedHoursImpactEl.textContent = "";
  } else {
    let timeString = '';
    if (missedHours > 0) {
        timeString += `${missedHours} hour${missedHours > 1 ? 's' : ''}`;
    }
    if (remainingMinutes > 0) {
        if (timeString) timeString += ' and ';
        timeString += `${remainingMinutes} minute${remainingMinutes > 1 ? 's' : ''}`;
    }
    
    missedHoursSummaryEl.textContent = `You have missed approximately ${timeString} of study time.`;
    missedHoursImpactEl.textContent = 
      `This time could have been used to deepen your understanding in areas like ${missedHours >= 2 ? 'advanced algorithms' : 'a new framework'}, 
      complete a mini-project, or revise challenging concepts. Consistent effort builds strong foundations!`;
  }
}

async function updateCurrentTaskAndFocus() {
  const now = new Date();
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const currentDayName = dayNames[now.getDay()];
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const dateString = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  let activeTask = null;
  let activeTaskName = "Free Time / Unscheduled";
  let taskProgress = 0;
  let taskStart = 0;
  let taskEnd = 0;
  let upcomingTasks = [];

  todayFocusDayEl.textContent = currentDayName;
  todayFocusDateEl.textContent = dateString;
  
  const tasksToday = scheduleData[currentDayName];
  if (tasksToday) {
    for (let i = 0; i < tasksToday.length; i++) {
      const task = tasksToday[i];
      const taskStartMinutes = timeToMinutes(task.start);
      const taskEndMinutes = timeToMinutes(task.end);
      
      if (currentMinutes >= taskStartMinutes && currentMinutes < taskEndMinutes) {
        activeTask = task;
        activeTaskName = task.task;
        taskStart = taskStartMinutes;
        taskEnd = taskEndMinutes;
        taskProgress = Math.min(100, Math.max(0, ((currentMinutes - taskStart) / (taskEnd - taskStart)) * 100));

        if (lastNotifiedTaskId !== task.id) {
          lastNotifiedTaskId = task.id;
          await sendPushoverNotification(
            `Time for: ${task.task}`,
            `From ${task.start} to ${task.end}`
          );
        }
        
        for (let j = i + 1; j < tasksToday.length && upcomingTasks.length < 3; j++) {
            if (!tasksToday[j].task.toLowerCase().includes("free time") && 
                !tasksToday[j].task.toLowerCase().includes("leisure")) {
                upcomingTasks.push(tasksToday[j]);
            }
        }
        break;
      } else if (currentMinutes < taskStartMinutes) {
        if (activeTask === null) {
            for (let j = i; j < tasksToday.length && upcomingTasks.length < 3; j++) {
                if (!tasksToday[j].task.toLowerCase().includes("free time") && 
                    !tasksToday[j].task.toLowerCase().includes("leisure")) {
                    upcomingTasks.push(tasksToday[j]);
                }
            }
        }
        break;
      }
    }
  }

  todayFocusCurrentTaskEl.textContent = activeTaskName;
  todayFocusProgressFill.style.width = `${taskProgress}%`;

  todayFocusUpcomingTasksEl.innerHTML = '';
  if (upcomingTasks.length > 0) {
    upcomingTasks.forEach(task => {
      const li = document.createElement('li');
      li.innerHTML = `<strong>${task.start}</strong>: ${task.task}`;
      todayFocusUpcomingTasksEl.appendChild(li);
    });
  } else {
    const li = document.createElement('li');
    li.textContent = "No more scheduled tasks for today.";
    todayFocusUpcomingTasksEl.appendChild(li);
  }

  if (currentlyHighlighted) {
    const prevTaskElement = document.getElementById(currentlyHighlighted);
    if (prevTaskElement) {
      prevTaskElement.classList.remove('current-task-highlight');
    }
  }

  if (activeTask && activeTask.id) {
    const currentTaskElement = document.getElementById(activeTask.id);
    if (currentTaskElement) {
      currentTaskElement.classList.add('current-task-highlight');
      currentlyHighlighted = activeTask.id;
    } else {
      currentlyHighlighted = null;
    }
  } else {
    currentlyHighlighted = null;
  }
}

async function initializeSchedule() {
  const completions = await fetchScheduleData();
  for (const day in scheduleData) {
    renderTasksForDay(day, scheduleData[day], completions);
  }
  updateMissedHoursSummary();
}

// Event listener for when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
  const savedUserKey = localStorage.getItem('pushoverUserKey');
  const savedApiToken = localStorage.getItem('pushoverApiToken');

  if (savedUserKey) {
    document.getElementById('pushover-user').value = savedUserKey;
    pushoverUserKey = savedUserKey;
  }

  if (savedApiToken) {
    document.getElementById('pushover-token').value = savedApiToken;
    pushoverApiToken = savedApiToken;
  }

  initializeSchedule();
  updateLiveClock();
  updateCurrentTaskAndFocus();

  setInterval(updateCurrentTaskAndFocus, 1000);
  setInterval(updateLiveClock, 1000);
});

// Animate day cards on page load
document.querySelectorAll('.day-card').forEach((card, index) => {
  card.style.animation = `fadeIn 0.5s ease ${index * 0.1}s forwards`;
  card.style.opacity = '0';
});
