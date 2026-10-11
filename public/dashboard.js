let loggedInUser = JSON.parse(localStorage.getItem('currentUser'));
let selectedUserId = null;
let pollInterval = null;
let allCachedUsers = [];

// Automatically switch backend URL depending on environment
const BACKEND_URL = import.meta.env.BACKEND_URL || 'http//localhost:5000'




const DEFAULT_AVATAR = 'resource/default_profile_pic.png';

// Authentication Verification Route
if (!loggedInUser) {
    window.location.href = 'index.html';
} else {
    updateNavbarProfile();
}

function updateNavbarProfile() {
    document.getElementById('current-user-name').innerText = loggedInUser.name;
    document.getElementById('current-user-avatar').src = (loggedInUser.profile_pic && loggedInUser.profile_pic.startsWith('http')) ? loggedInUser.profile_pic : DEFAULT_AVATAR;
}

function logout() {
    localStorage.removeItem('currentUser');
    clearInterval(pollInterval);
    window.location.href = 'index.html';
}

// Directory Search & Listing Management
async function fetchUsers() {
    try {
        const response = await fetch('${BACKEND_URL}/api/users');
        allCachedUsers = await response.json();
        renderUsers(allCachedUsers);
    } catch (error) { 
        console.error("Error loading users:", error); 
    }
}

function renderUsers(usersList) {
    const directory = document.getElementById('users-directory');
    directory.innerHTML = usersList
        .filter(user => user.id !== loggedInUser.id)
        .map(user => {
            // If the user profile pic is a full server URL, use it; otherwise use the local default resource
            const avatarSrc = (user.profile_pic && user.profile_pic.startsWith('http')) 
                ? user.profile_pic 
                : DEFAULT_AVATAR;
                
            return `
                <li class="user-item" id="user-${user.id}" onclick="selectUser(${user.id}, '${user.name.replace(/'/g, "\\'")}', '${avatarSrc}')">
                    <img class="list-avatar" src="${avatarSrc}">
                    <div>
                        <strong>${user.name}</strong><br>
                        <span style="font-size:12px; color:#777;">${user.email}</span>
                    </div>
                    <span class="status-dot"></span>
                </li>
            `;
        }).join('');
}


function filterUsers() {
    const searchTerm = document.getElementById('search-input').value.toLowerCase();
    const filtered = allCachedUsers.filter(user => 
        user.name.toLowerCase().includes(searchTerm) || 
        user.email.toLowerCase().includes(searchTerm)
    );
    renderUsers(filtered);
}

// Conversation Thread Actions
function selectUser(id, name, avatar) {
    selectedUserId = id;
    document.querySelectorAll('.user-item').forEach(item => item.classList.remove('active'));
    
    const currentItem = document.getElementById(`user-${id}`);
    if (currentItem) currentItem.classList.add('active');
    
    document.getElementById('active-chat-partner').innerHTML = `
        <img class="list-avatar" src="${avatar}">  
        <span>${name}</span> 
        <span class="status-dot"></span>
    `;
    
    document.getElementById('message-input').removeAttribute('disabled');
    document.getElementById('send-btn').removeAttribute('disabled');
    document.getElementById('message-input').focus();
    
    loadChatHistory();
    clearInterval(pollInterval);
    pollInterval = setInterval(loadChatHistory, 2000); 
}

async function loadChatHistory() {
    if (!selectedUserId) return;
    try {
        const response = await fetch(`${BACKEND_URL}${loggedInUser.id}/${selectedUserId}`);
        const messages = await response.json();
        const msgBox = document.getElementById('messages-box');
        
        msgBox.innerHTML = messages.map(msg => {
            const isSent = msg.sender_id === loggedInUser.id;
            let mediaContent = '';
            if (msg.message_type === 'image' && msg.file_url) {
                mediaContent = `<img src="${msg.file_url}" alt="Shared Image">`;
            }
            return `
                <div class="msg ${isSent ? 'sent' : 'received'}">
                    ${mediaContent}
                    ${msg.message_text ? `<span>${msg.message_text}</span>` : ''}
                    <span class="msg-time">${msg.formatted_time || ''}</span>
                </div>
            `;
        }).join('');
        msgBox.scrollTop = msgBox.scrollHeight;
    } catch (error) {
        console.error("Error loading chat logs:", error);
    }
}

// Data Dispatch Execution Endpoints (Text and Images)
async function sendMessage() {
    const input = document.getElementById('message-input');
    const messageText = input.value.trim();
    if (!messageText || !selectedUserId) return;

    const formData = new FormData();
    formData.append('sender_id', loggedInUser.id);
    formData.append('receiver_id', selectedUserId);
    formData.append('message_text', messageText);
    formData.append('message_type', 'text');

    try {
        const response = await fetch('${BACKEND_URL}/api/messages', { method: 'POST', body: formData });
        if (response.ok) { 
            input.value = ''; 
            loadChatHistory(); 
        }
    } catch (error) { console.error(error); }
}

async function sendImage(fileInput) {
    if (!fileInput.files || fileInput.files.length === 0 || !selectedUserId) return;
    
    const formData = new FormData();
    formData.append('sender_id', loggedInUser.id);
    formData.append('receiver_id', selectedUserId);
    formData.append('message_type', 'image');
    formData.append('image_file', fileInput.files[0]);

    try {
        const response = await fetch('${BACKEND_URL}/api/messages', { method: 'POST', body: formData });
        if (response.ok) { 
            fileInput.value = ''; 
            loadChatHistory(); 
        }
    } catch (error) { console.error(error); }
}

// Profile Modal Interactions
function openModal() {
    document.getElementById('profile-modal').style.display = 'flex';
    document.getElementById('modal-email').innerText = loggedInUser.email;
    document.getElementById('modal-avatar-preview').src = (loggedInUser.profile_pic && loggedInUser.profile_pic.startsWith('http')) ? loggedInUser.profile_pic : DEFAULT_AVATAR;
}

function closeModal() {
    document.getElementById('profile-modal').style.display = 'none';
}

async function uploadProfilePic(event) {
    event.preventDefault();
    const fileInput = document.getElementById('new-avatar-input');
    if (!fileInput.files || fileInput.files.length === 0) return;

    const formData = new FormData();
    formData.append('userId', loggedInUser.id);
    formData.append('profile_pic', fileInput.files[0]);

    try {
        const response = await fetch('${BACKEND_URL}/api/users/profile-pic', { method: 'POST', body: formData });
        const data = await response.json();
        if (response.ok) {
            loggedInUser = data.user;
            localStorage.setItem('currentUser', JSON.stringify(loggedInUser));
            updateNavbarProfile();
            fetchUsers();
            closeModal();
            alert('Profile image updated successfully!');
        } else {
            alert(data.message || 'Upload failed');
        }
    } catch (error) { console.error(error); }
}

document.getElementById('message-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

// Run execution directly upon loading layout file
fetchUsers();
