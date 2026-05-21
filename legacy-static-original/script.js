const storageKey = "workQueueOperationsBoardTasks";

const starterTasks = [
    {
        id: crypto.randomUUID(),
        title: "Review New Support Intake",
        owner: "Nadia",
        priority: "High",
        dueDate: "2026-05-02",
        status: "To Do"
    },
    {
        id: crypto.randomUUID(),
        title: "Prepare Weekly Operations Report",
        owner: "Jaco",
        priority: "Medium",
        dueDate: "2026-05-04",
        status: "In Progress"
    },
    {
        id: crypto.randomUUID(),
        title: "Close Vendor Follow-Up",
        owner: "Liam",
        priority: "Low",
        dueDate: "2026-05-01",
        status: "Done"
    }
];

function getTasks() {
    const saved = localStorage.getItem(storageKey);
    if (!saved) {
        localStorage.setItem(storageKey, JSON.stringify(starterTasks));
        return starterTasks;
    }
    return JSON.parse(saved);
}

function saveTasks(tasks) {
    localStorage.setItem(storageKey, JSON.stringify(tasks));
}

function updateMetrics(tasks) {
    document.getElementById("totalTasks").textContent = tasks.length;
    document.getElementById("todoCount").textContent = tasks.filter(task => task.status === "To Do").length;
    document.getElementById("progressCount").textContent = tasks.filter(task => task.status === "In Progress").length;
    document.getElementById("doneCount").textContent = tasks.filter(task => task.status === "Done").length;
}

function formatStatusClass(status) {
    return status.replace(/\s+/g, "");
}

function renderTasks() {
    const allTasks = getTasks();
    updateMetrics(allTasks);

    const statusFilter = document.getElementById("statusFilter").value;
    const priorityFilter = document.getElementById("priorityFilter").value;

    const filteredTasks = allTasks.filter(task => {
        const statusMatch = statusFilter === "All" || task.status === statusFilter;
        const priorityMatch = priorityFilter === "All" || task.priority === priorityFilter;
        return statusMatch && priorityMatch;
    });

    const grid = document.getElementById("taskGrid");
    grid.innerHTML = "";

    if (filteredTasks.length === 0) {
        grid.innerHTML = `<p class="empty-state">No tasks match the current filters.</p>`;
        return;
    }

    filteredTasks.forEach(task => {
        const article = document.createElement("article");
        article.className = "task-card";
        article.innerHTML = `
            <h3>${task.title}</h3>
            <p><strong>Owner:</strong> ${task.owner}</p>
            <p><strong>Due Date:</strong> ${task.dueDate}</p>
            <span class="priority-tag priority-${task.priority}">${task.priority}</span>
            <span class="status-tag status-${formatStatusClass(task.status)}">${task.status}</span>
            <div class="task-actions">
                <button type="button" onclick="advanceStatus('${task.id}')">Advance Status</button>
                <button type="button" onclick="removeTask('${task.id}')">Remove</button>
            </div>
        `;
        grid.appendChild(article);
    });
}

function advanceStatus(taskId) {
    const tasks = getTasks().map(task => {
        if (task.id !== taskId) {
            return task;
        }

        if (task.status === "To Do") {
            return { ...task, status: "In Progress" };
        }

        if (task.status === "In Progress") {
            return { ...task, status: "Done" };
        }

        return task;
    });

    saveTasks(tasks);
    renderTasks();
}

function removeTask(taskId) {
    const tasks = getTasks().filter(task => task.id !== taskId);
    saveTasks(tasks);
    renderTasks();
}

document.getElementById("taskForm").addEventListener("submit", event => {
    event.preventDefault();

    const title = document.getElementById("taskTitle").value.trim();
    const owner = document.getElementById("taskOwner").value.trim();
    const priority = document.getElementById("taskPriority").value;
    const dueDate = document.getElementById("taskDueDate").value;
    const status = document.getElementById("taskStatus").value;

    if (!title || !owner || !priority || !dueDate || !status) {
        return;
    }

    const tasks = getTasks();
    tasks.unshift({
        id: crypto.randomUUID(),
        title,
        owner,
        priority,
        dueDate,
        status
    });

    saveTasks(tasks);
    event.target.reset();
    renderTasks();
});

document.getElementById("statusFilter").addEventListener("change", renderTasks);
document.getElementById("priorityFilter").addEventListener("change", renderTasks);

renderTasks();
