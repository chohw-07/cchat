/**
 * cchat - 서버 없는 P2P 채팅 애플리케이션
 * PeerJS 라이브러리를 사용하여 브라우저 간 직접 통신
 * 
 * 주요 개선 사항:
 * 1. 디스코드스러운 UI/UX 개선
 * 2. 보이스 채팅 기능 추가
 * 3. 간단한 CAPTCHA 추가
 * 4. URL 링크 통한 직접 연결 개선
 * 5. 이미지 및 미디어 처리 개선
 * 6. 언어 지원 및 단축키 추가
 * 7. 방장 이임 기능 구현
 */

// 상수 정의
const APP_NAME = 'cchat';
const DOMAIN = 'cchat.kro.kr';
const APP_VERSION = '2.0.0';
const MAX_RETRY_COUNT = 5;
const LOCALE_DEFAULT = 'ko'; // 기본 언어 설정
const AUDIO_PATH = './sounds/'; // 효과음 디렉토리 경로

// 효과음 정의
const SOUNDS = {
    MESSAGE: 'message.mp3',
    CONNECT: 'connect.mp3',
    DISCONNECT: 'disconnect.mp3',
    ERROR: 'error.mp3',
    VOICE_JOIN: 'voice_join.mp3',
    VOICE_LEAVE: 'voice_leave.mp3'
};

// ICE 서버 설정 개선 (STUN/TURN 서버 추가)
const ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:stun.ekiga.net' },
    { urls: 'stun:stun.ideasip.com' },
    { urls: 'stun:stun.stunprotocol.org:3478' },
    { urls: 'stun:stun.voiparound.com' },
    { urls: 'stun:stun.voipbuster.com' },
    { urls: 'stun:stun.voipstunt.com' },
    { urls: 'stun:stun.voxgratia.org' },
    { urls: 'stun:global.stun.twilio.com:3478' }, // ✅ 수정됨
    {
        urls: 'turn:numb.viagenie.ca',
        credential: 'muazkh',
        username: 'webrtc@live.com'
    },
    {
        urls: 'turn:turn.anyfirewall.com:443',
        credential: 'webrtc',
        username: 'webrtc'
    },
    {
        urls: 'turn:openrelay.metered.ca:80',
        credential: 'openrelayproject',
        username: 'openrelayproject'
    },
    {
        urls: 'turn:openrelay.metered.ca:443',
        credential: 'openrelayproject',
        username: 'openrelayproject'
    },
    {
        urls: 'turn:openrelay.metered.ca:443',
        credential: 'openrelayproject',
        username: 'openrelayproject'
    }
];


// 기본 이모지
const DEFAULT_EMOJIS = {
    "😀": "grinning face",
    "😃": "grinning face with big eyes",
    "😄": "grinning face with smiling eyes",
    "😁": "beaming face with smiling eyes",
    "😆": "grinning squinting face",
    "😅": "grinning face with sweat",
    "🤣": "rolling on the floor laughing",
    "😂": "face with tears of joy",
    "🙂": "slightly smiling face",
    "🙃": "upside-down face",
    "❤️": "red heart",
    "👍": "thumbs up",
    "👎": "thumbs down",
    "👏": "clapping hands",
    "🔥": "fire",
    "🎉": "party popper",
    "👀": "eyes"
};

// 애플리케이션 상태
const appState = {
    // 기존 상태 변수들
    peer: null,                 // PeerJS 인스턴스
    connections: {},            // 연결된 피어들 (데이터 채널)
    voiceConnections: {},       // 음성 연결 (미디어 채널)
    localStream: null,          // 로컬 오디오 스트림
    localUserId: null,          // 로컬 사용자 ID
    localUserName: null,        // 로컬 사용자 이름
    localUserAvatar: null,      // 로컬 사용자 프로필 이미지
    localUserStatus: 'online',  // 사용자 상태 (online, away, dnd)
    roomId: null,               // 현재 방 ID
    isHost: false,              // 방 생성자 여부
    isAdmin: false,             // 관리자 여부
    users: {},                  // 연결된 사용자들 {userId: {name, avatar, role, status}}
    pendingMessages: [],        // 대기 중인 메시지들
    messageHistory: [],         // 메시지 히스토리
    deletedMessages: {},        // 삭제된 메시지 ID 저장
    bannedUsers: {},            // 차단된 사용자
    timeoutUsers: {},           // 타임아웃된 사용자
    fileChunks: {},             // 파일 청크 저장소
    connectionRetryCount: 0,    // 연결 재시도 횟수
    channels: {                 // 채널 목록
        'general': { name: '일반', messages: [], type: 'text' }
    },
    voiceChannels: {            // 음성 채널 목록
        'voice-general': { name: '일반 음성채팅', users: [], type: 'voice' }
    },
    currentChannel: 'general',  // 현재 채널
    currentVoiceChannel: null,  // 현재 연결된 음성 채널
    notifications: {            // 알림 설정
        enabled: true,          // 알림 활성화 여부
        permission: null,       // 알림 권한 상태
        desktop: true,          // 데스크톱 알림 사용 여부
        sound: true             // 알림 소리 사용 여부
    },
    typing: {                   // 타이핑 상태
        users: {},              // 타이핑 중인 사용자
        timeout: null,          // 타이핑 타임아웃
        isTyping: false         // 현재 타이핑 중인지 여부
    },
    peerConnectionStats: {},    // 피어 연결 상태 통계
    connectionEstablished: false, // 연결 설정 완료 여부
    language: LOCALE_DEFAULT,   // 현재 언어 설정
    translations: {},           // 번역 데이터
    noiseSuppression: true,     // 잡음 제거 기능 활성화 여부
    echoCancellation: true,     // 에코 제거 기능 활성화 여부
    captchaVerified: false,     // CAPTCHA 검증 여부
    shortcuts: {                // 키보드 단축키
        active: true,
        keybinds: {
            'Escape': 'closeModals',
            'Alt+M': 'toggleMute',
            'Alt+D': 'toggleDeafen',
            'Alt+S': 'openSettings',
            'Alt+U': 'openUserList',
            'Alt+C': 'openChannelList',
            'Alt+V': 'toggleVoice'
        }
    }
};

/**
 * UI 요소
 */
const UI = {
    // 모달
    entryModal: document.getElementById('entryModal'),
    createRoomModalBtn: document.getElementById('createRoomModalBtn'),
    joinRoomModalBtn: document.getElementById('joinRoomModalBtn'),
    joinCodeModalInput: document.getElementById('joinCodeModalInput'),
    userNameModalInput: document.getElementById('userNameModalInput'),
    
    captchaModal: document.getElementById('captchaModal'),
    captchaImage: document.getElementById('captchaImage'),
    captchaInput: document.getElementById('captchaInput'),
    verifyCaptchaBtn: document.getElementById('verifyCaptchaBtn'),
    
    nameSetupModal: document.getElementById('nameSetupModal'),
    nameSetupInput: document.getElementById('nameSetupInput'),
    nameSetupAvatarPreview: document.getElementById('nameSetupAvatarPreview'),
    nameSetupAvatarInput: document.getElementById('nameSetupAvatarInput'),
    saveNameBtn: document.getElementById('saveNameBtn'),
    
    inviteModal: document.getElementById('inviteModal'),
    closeInviteModal: document.getElementById('closeInviteModal'),
    inviteCode: document.getElementById('inviteCode'),
    inviteLink: document.getElementById('inviteLink'),
    copyInviteBtn: document.getElementById('copyInviteBtn'),
    copyLinkBtn: document.getElementById('copyLinkBtn'),
    
    connectionModal: document.getElementById('connectionModal'),
    connectionStep1: document.getElementById('step1'),
    connectionStep2: document.getElementById('step2'),
    connectionStep3: document.getElementById('step3'),
    connectionError: document.getElementById('connectionError'),
    retryConnectionBtn: document.getElementById('retryConnectionBtn'),
    
    profileModal: document.getElementById('profileModal'),
    profileNameInput: document.getElementById('profileNameInput'),
    currentAvatar: document.getElementById('currentAvatar'),
    notificationToggle: document.getElementById('notificationToggle'),
    
    adminModal: document.getElementById('adminModal'),
    adminUserList: document.getElementById('adminUserList'),
    adminChannelList: document.getElementById('adminChannelList'),
    newChannelInput: document.getElementById('newChannelInput'),
    
    userManageModal: document.getElementById('userManageModal'),
    managedUserName: document.getElementById('managedUserName'),
    userManageInfo: document.getElementById('userManageInfo'),
    
    transferOwnerModal: document.getElementById('transferOwnerModal'),
    transferOwnerList: document.getElementById('transferOwnerList'),
    
    emojiPicker: document.getElementById('emojiPicker'),
    emojiGrid: document.getElementById('emojiGrid'),
    emojiButton: document.getElementById('emojiButton'),
    
    voiceSettingsModal: document.getElementById('voiceSettingsModal'),
    noiseSuppressionToggle: document.getElementById('noiseSuppressionToggle'),
    echoCancellationToggle: document.getElementById('echoCancellationToggle'),
    
    // 메인 UI
    chatScreen: document.getElementById('chatScreen'),
    userName: document.getElementById('userName'),
    userAvatar: document.getElementById('userAvatar'),
    inviteBtn: document.getElementById('inviteBtn'),
    roomName: document.getElementById('roomName'),
    chatMessages: document.getElementById('chatMessages'),
    messageInput: document.getElementById('messageInput'),
    sendMessageBtn: document.getElementById('sendMessageBtn'),
    usersList: document.getElementById('usersList'),
    connectionStatus: document.getElementById('connectionStatus'),
    fileInput: document.getElementById('fileInput'),
    qrContainer: document.getElementById('qrContainer'),
    channelsList: document.getElementById('channelsList'),
    voiceChannelsList: document.getElementById('voiceChannelsList'),
    addChannelIcon: document.getElementById('addChannelIcon'),
    addVoiceChannelIcon: document.getElementById('addVoiceChannelIcon'),
    typingIndicator: document.getElementById('typingIndicator'),
    statusSelector: document.getElementById('statusSelector'),
    languageSelector: document.getElementById('languageSelector'),
    voiceControls: document.getElementById('voiceControls'),
    muteBtn: document.getElementById('muteBtn'),
    deafenBtn: document.getElementById('deafenBtn'),
    disconnectBtn: document.getElementById('disconnectBtn'),
    voiceUsers: document.getElementById('voiceUsers')
};

/**
 * 안전하게 DOM 요소 접근
 * @param {string} id - 요소 ID
 * @param {function} callback - 접근 성공 시 콜백
 */
function safeGetElement(id, callback) {
    const element = document.getElementById(id);
    if (element && typeof callback === 'function') {
        callback(element);
    }
    return element;
}

/**
 * 애플리케이션 초기화
 */
function initializeApp() {
    console.log(`${APP_NAME} 애플리케이션 초기화 중... 버전: ${APP_VERSION}`);
    
    // 언어 데이터 로드
    loadLanguage(appState.language);
    
    // 로컬 스토리지에서 사용자 설정 불러오기
    loadUserSettings();
    
    // URL에서 초대 코드 확인
    checkUrlForInviteCode();
    
    // 이벤트 리스너 설정
    setupEventListeners();
    
    // 알림 권한 확인
    checkNotificationPermission();
    
    // 키보드 단축키 설정
    setupKeyboardShortcuts();
    
    // 이모지 피커 초기화
    initEmojiPicker();
    
    // 보이스 컨트롤 초기 설정
    setupVoiceControls();
    
    // 디버그 정보 추가
    console.info(`${APP_NAME} 버전: ${APP_VERSION}`);
    console.info('WebRTC 지원: ', navigator.mediaDevices ? '지원됨' : '지원되지 않음');
    console.info('로컬 스토리지 지원: ', window.localStorage ? '지원됨' : '지원되지 않음');
}

/**
 * 언어 데이터 로드
 * @param {string} lang - 언어 코드
 */
function loadLanguage(lang) {
    // 파일 시스템에서 실행 시 기본 언어 데이터 사용
    if (window.location.protocol === 'file:') {
        console.log('파일 시스템에서 실행 중 - 내장 언어 데이터 사용');
        
        // 한국어 기본 데이터
        const koData = {
            "welcome": "CCHAT 에 오신 것을 환영합니다",
            "create_room": "방 만들기",
            "join_room": "방 참여하기",
            "enter_invite_code": "초대 코드 입력",
            "join": "참여하기",
            "user_name_setup": "사용자 이름 설정",
            "enter_user_name": "사용자 이름 입력",
            "channels": "채널",
            "voice_channels": "음성 채널",
            "online_users": "접속 중인 사용자",
            "captcha_verification": "보안 확인",
            "captcha_instruction": "아래에 표시된 문자를 입력하세요",
            "verify": "확인",
            "name_setup": "이름 설정",
            "select_avatar": "프로필 이미지 선택",
            "name": "이름",
            "save_name": "저장",
            "invite_friends": "친구 초대하기",
            "invite_code": "초대 코드",
            "copy_code": "코드 복사",
            "invite_link": "초대 링크",
            "copy_link": "링크 복사",
            "connecting": "연결 중...",
            "connection_error": "연결 오류",
            "retry": "다시 시도",
            "captcha_failed": "보안 확인에 실패했습니다",
            "enter_message": "메시지 입력...",
            "send": "전송",
            "profile_settings": "프로필 설정",
            "status": "상태",
            "status_online": "온라인",
            "status_away": "자리 비움",
            "status_dnd": "방해 금지",
            "status_offline": "오프라인",
            "notification_settings": "알림 설정",
            "desktop_notifications": "데스크톱 알림",
            "sound_notifications": "알림 소리",
            "notification_permission_required": "알림 권한이 필요합니다. 브라우저 설정에서 권한을 허용해주세요.",
            "request_permission": "권한 요청",
            "voice_settings": "음성 설정",
            "noise_suppression": "잡음 제거",
            "echo_cancellation": "에코 제거",
            "language_settings": "언어 설정",
            "language": "언어",
            "theme_settings": "테마 설정",
            "light_theme": "밝은 테마",
            "save": "저장",
            "admin_menu": "관리자 메뉴",
            "user_management": "사용자 관리",
            "channel_management": "채널 관리",
            "channel_name": "채널 이름",
            "add_channel": "채널 추가",
            "voice_channel": "음성 채널",
            "text_channel": "텍스트 채널",
            "file_shared": "파일 공유: {name}",
            "new_message": "새 메시지",
            "host": "방장",
            "admin": "관리자",
            "user": "사용자",
            "room": "방 #{room}",
            "settings_saved": "설정이 저장되었습니다",
            "language_changed": "언어가 변경되었습니다",
            "transferred_ownership": "방장 권한을 {user}에게 이임했습니다",
            "connection_lost": "연결이 끊겼습니다",
            "waiting_users": "사용자 대기 중 ({count})",
            "connected": "연결됨",
            "connected_with_users": "연결됨 ({count}명)",
            "room_created": "방이 생성되었습니다. 초대 코드: {code}",
            "invite_instruction": "상단의 초대 버튼을 눌러 친구를 초대하세요",
            "joined_room": "방에 참여했습니다: {room}",
            "delete": "삭제",
            "deleted_message": "삭제된 메시지",
            "user_left": "{user}님이 퇴장했습니다",
            "user_joined": "{user}님이 입장했습니다",
            "webrtc_not_supported": "이 브라우저에서는 음성 채팅이 지원되지 않습니다",
            "microphone_permission_error": "마이크 권한이 필요합니다",
            "profile_saved": "프로필이 저장되었습니다",
            "copied_invite_code": "초대 코드가 복사되었습니다",
            "copied_invite_link": "초대 링크가 복사되었습니다",
            "internet_connected": "인터넷 연결이 복구되었습니다",
            "internet_disconnected": "인터넷 연결이 끊겼습니다",
            "download": "다운로드"
        };
        
        // 영어 기본 데이터
        const enData = {
            "welcome": "Welcome to CCHAT",
            "create_room": "Create Room",
            "join_room": "Join Room",
            "enter_invite_code": "Enter invite code",
            "join": "Join",
            "user_name_setup": "User Name Setup",
            "enter_user_name": "Enter user name",
            "channels": "Channels",
            "voice_channels": "Voice Channels",
            "online_users": "Online Users",
            "captcha_verification": "Security Verification",
            "captcha_instruction": "Enter the characters shown below",
            "verify": "Verify",
            "name_setup": "Name Setup",
            "select_avatar": "Select Profile Image",
            "name": "Name",
            "save_name": "Save",
            "invite_friends": "Invite Friends",
            "invite_code": "Invite Code",
            "copy_code": "Copy Code",
            "invite_link": "Invite Link",
            "copy_link": "Copy Link",
            "connecting": "Connecting...",
            "connection_error": "Connection Error",
            "retry": "Retry",
            "captcha_failed": "Security verification failed",
            "enter_message": "Enter message...",
            "send": "Send",
            "profile_settings": "Profile Settings",
            "status": "Status",
            "status_online": "Online",
            "status_away": "Away",
            "status_dnd": "Do Not Disturb",
            "status_offline": "Offline",
            "notification_settings": "Notification Settings",
            "desktop_notifications": "Desktop Notifications",
            "sound_notifications": "Sound Notifications",
            "notification_permission_required": "Notification permission is required. Please enable it in your browser settings.",
            "request_permission": "Request Permission",
            "voice_settings": "Voice Settings",
            "noise_suppression": "Noise Suppression",
            "echo_cancellation": "Echo Cancellation",
            "language_settings": "Language Settings",
            "language": "Language",
            "theme_settings": "Theme Settings",
            "light_theme": "Light Theme",
            "save": "Save",
            "admin_menu": "Admin Menu",
            "user_management": "User Management",
            "channel_management": "Channel Management",
            "channel_name": "Channel Name",
            "add_channel": "Add Channel",
            "voice_channel": "Voice Channel",
            "text_channel": "Text Channel",
            "file_shared": "File shared: {name}",
            "new_message": "New message",
            "host": "Host",
            "admin": "Admin",
            "user": "User",
            "room": "Room #{room}",
            "settings_saved": "Settings saved",
            "language_changed": "Language changed",
            "transferred_ownership": "Transferred ownership to {user}",
            "connection_lost": "Connection lost",
            "waiting_users": "Waiting for users ({count})",
            "connected": "Connected",
            "connected_with_users": "Connected with {count} users",
            "room_created": "Room created. Invite code: {code}",
            "invite_instruction": "Click the invite button to invite friends",
            "joined_room": "Joined room: {room}",
            "delete": "Delete",
            "deleted_message": "Message deleted",
            "user_left": "{user} has left",
            "user_joined": "{user} has joined",
            "webrtc_not_supported": "Voice chat is not supported in this browser",
            "microphone_permission_error": "Microphone permission is required",
            "profile_saved": "Profile saved",
            "copied_invite_code": "Invite code copied",
            "copied_invite_link": "Invite link copied",
            "internet_connected": "Internet connection restored",
            "internet_disconnected": "Internet connection lost",
            "download": "Download"
        };
        
        // 언어 선택에 따라 데이터 설정
        if (lang === 'en') {
            appState.translations = enData;
        } else {
            appState.translations = koData;
        }
        
        // UI 언어 업데이트
        updateUILanguage();
        return; // 여기서 종료
    }
    
    // 웹 서버에서 실행 시 일반적인 방법으로 언어 파일 로드
    fetch(`./lang/${lang}.json`)
        .then(response => response.json())
        .then(data => {
            appState.translations = data;
            updateUILanguage();
        })
        .catch(error => {
            console.error('언어 파일 로드 중 오류:', error);
            // 기본 언어 (한국어) 다시 시도
            if (lang !== LOCALE_DEFAULT) {
                loadLanguage(LOCALE_DEFAULT);
            }
        });
}

/**
 * UI 언어 업데이트
 */
function updateUILanguage() {
    const t = appState.translations;
    
    // 언어 선택기 업데이트
    if (UI.languageSelector) {
        UI.languageSelector.value = appState.language;
    }
    
    // 각 요소의 텍스트 업데이트
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        if (t[key]) {
            element.textContent = t[key];
        }
    });
    
    // 플레이스홀더 텍스트 업데이트
    document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
        const key = element.getAttribute('data-i18n-placeholder');
        if (t[key]) {
            element.placeholder = t[key];
        }
    });
    
    // 버튼 텍스트 업데이트
    document.querySelectorAll('[data-i18n-value]').forEach(element => {
        const key = element.getAttribute('data-i18n-value');
        if (t[key]) {
            element.value = t[key];
        }
    });
    
    // 타이틀 속성 업데이트
    document.querySelectorAll('[data-i18n-title]').forEach(element => {
        const key = element.getAttribute('data-i18n-title');
        if (t[key]) {
            element.title = t[key];
        }
    });
}

/**
 * 번역 함수
 * @param {string} key - 번역 키
 * @param {Object} params - 치환할 파라미터
 * @return {string} 번역된 텍스트
 */
function t(key, params = {}) {
    let text = appState.translations[key] || key;
    
    // 파라미터 치환
    Object.entries(params).forEach(([key, value]) => {
        text = text.replace(new RegExp(`{{${key}}}`, 'g'), value);
    });
    
    return text;
}

/**
 * 키보드 단축키 설정
 */
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', function(e) {
        // 단축키가 비활성화 되어 있거나 입력 필드에 포커스가 있으면 무시
        if (!appState.shortcuts.active || 
            (document.activeElement && 
             (document.activeElement.tagName === 'INPUT' || 
              document.activeElement.tagName === 'TEXTAREA'))) {
            return;
        }
        
        let shortcutKey = '';
        if (e.altKey) shortcutKey += 'Alt+';
        if (e.ctrlKey) shortcutKey += 'Ctrl+';
        if (e.shiftKey) shortcutKey += 'Shift+';
        shortcutKey += e.key;
        
        // 정의된 단축키 확인 및 실행
        const action = appState.shortcuts.keybinds[shortcutKey];
        if (action) {
            e.preventDefault();
            executeShortcut(action);
        }
        
        // 엔터키 누르면 메시지 입력창으로 포커스
        if (e.key === 'Enter' && !document.activeElement.tagName === 'INPUT' && UI.messageInput) {
            UI.messageInput.focus();
        }
    });
}

/**
 * 단축키 실행
 * @param {string} action - 실행할 액션
 */
function executeShortcut(action) {
    switch (action) {
        case 'closeModals':
            closeAllModals();
            break;
        case 'toggleMute':
            toggleMicrophone();
            break;
        case 'toggleDeafen':
            toggleDeafen();
            break;
        case 'openSettings':
            showProfileModal();
            break;
        case 'openUserList':
            toggleUsersPanel();
            break;
        case 'openChannelList':
            toggleChannelsPanel();
            break;
        case 'toggleVoice':
            if (appState.currentVoiceChannel) {
                leaveVoiceChannel();
            } else {
                joinVoiceChannel('voice-general');
            }
            break;
    }
}

/**
 * 모든 모달 닫기
 */
function closeAllModals() {
    document.querySelectorAll('.modal-overlay:not(.hidden)').forEach(modal => {
        modal.classList.add('hidden');
    });
}

/**
 * 이모지 피커 초기화
 */
function initEmojiPicker() {
    // 필요한 요소 확인
    if (!UI.emojiGrid || !UI.emojiButton || !UI.emojiPicker) {
        console.warn('이모지 피커 초기화 실패: UI 요소 없음');
        return;
    }
    
    // 기존 이벤트 제거 (중복 방지)
    UI.emojiButton.removeEventListener('click', toggleEmojiPicker);
    
    // 이모지 그리드 생성
    UI.emojiGrid.innerHTML = '';
    Object.keys(DEFAULT_EMOJIS).forEach(emoji => {
        const emojiButton = document.createElement('button');
        emojiButton.className = 'emoji-item';
        emojiButton.textContent = emoji;
        emojiButton.title = DEFAULT_EMOJIS[emoji];
        emojiButton.addEventListener('click', (e) => {
            e.stopPropagation(); // 이벤트 버블링 방지
            if (UI.messageInput) {
                insertTextAtCursor(UI.messageInput, emoji);
                UI.messageInput.focus(); // 입력창에 포커스 유지
            }
            toggleEmojiPicker(false);
        });
        UI.emojiGrid.appendChild(emojiButton);
    });
    
    // 이모지 버튼 이벤트
    UI.emojiButton.addEventListener('click', (e) => {
        e.stopPropagation(); // 이벤트 버블링 방지
        toggleEmojiPicker();
    });
    
    // 외부 클릭 시 피커 닫기
    document.addEventListener('click', (e) => {
        if (UI.emojiPicker && !UI.emojiPicker.contains(e.target) && 
            UI.emojiButton && !UI.emojiButton.contains(e.target)) {
            toggleEmojiPicker(false);
        }
    });
    
    // 초기 상태는 닫혀있음
    UI.emojiPicker.classList.add('hidden');
}
function toggleEmojiPicker(show) {
    if (!UI.emojiPicker) return;
    
    // 이모지 피커 위치 업데이트 (입력창 위에 정확히 위치하도록)
    if (UI.messageInput && UI.emojiButton) {
        const buttonRect = UI.emojiButton.getBoundingClientRect();
        UI.emojiPicker.style.bottom = '70px';
        UI.emojiPicker.style.left = `${buttonRect.left}px`;
    }
    
    if (show === undefined) {
        UI.emojiPicker.classList.toggle('hidden');
    } else {
        if (show) {
            UI.emojiPicker.classList.remove('hidden');
        } else {
            UI.emojiPicker.classList.add('hidden');
        }
    }
}
/**
 * 이모지 피커 토글
 * @param {boolean} show - 표시 여부
 */
function toggleEmojiPicker(show) {
    if (!UI.emojiPicker) return;
    
    if (show === undefined) {
        UI.emojiPicker.classList.toggle('hidden');
    } else {
        if (show) {
            UI.emojiPicker.classList.remove('hidden');
        } else {
            UI.emojiPicker.classList.add('hidden');
        }
    }
}

/**
 * 커서 위치에 텍스트 삽입
 * @param {HTMLElement} input - 입력 요소
 * @param {string} text - 삽입할 텍스트
 */
function insertTextAtCursor(input, text) {
    if (!input) return;
    
    const start = input.selectionStart || 0;
    const end = input.selectionEnd || 0;
    const value = input.value || '';
    
    input.value = value.substring(0, start) + text + value.substring(end);
    input.selectionStart = input.selectionEnd = start + text.length;
    
    // 변경 이벤트 발생시켜 타이핑 상태 감지
    const event = new Event('input', { bubbles: true });
    input.dispatchEvent(event);
}

/**
 * 보이스 채팅 컨트롤 설정
 */
function setupVoiceControls() {
    if (!UI.voiceControls) return;
    
    // 초기 상태는 숨김
    UI.voiceControls.classList.add('hidden');
    
    // 음소거 버튼
    if (UI.muteBtn) {
        UI.muteBtn.addEventListener('click', toggleMicrophone);
    }
    
    // 헤드셋 버튼 (들리지 않게)
    if (UI.deafenBtn) {
        UI.deafenBtn.addEventListener('click', toggleDeafen);
    }
    
    // 연결 끊기 버튼
    if (UI.disconnectBtn) {
        UI.disconnectBtn.addEventListener('click', leaveVoiceChannel);
    }
}

/**
 * 마이크 음소거/해제 토글
 */
function toggleMicrophone() {
    if (!appState.localStream) return;
    
    const audioTracks = appState.localStream.getAudioTracks();
    if (audioTracks.length === 0) return;
    
    const isMuted = !audioTracks[0].enabled;
    
    audioTracks.forEach(track => {
        track.enabled = isMuted;
    });
    
    // UI 업데이트
    if (UI.muteBtn) {
        if (isMuted) {
            UI.muteBtn.classList.remove('active');
            UI.muteBtn.title = t('unmute');
        } else {
            UI.muteBtn.classList.add('active');
            UI.muteBtn.title = t('mute');
        }
    }
    
    // 다른 사용자들에게 상태 알림
    if (appState.currentVoiceChannel) {
        broadcastMessage({
            type: 'voice',
            action: 'mute_status',
            userId: appState.localUserId,
            isMuted: !isMuted
        });
    }
}

/**
 * 헤드셋 토글 (소리 듣기/안듣기)
 */
function toggleDeafen() {
    // 음성 출력 음소거 상태 토글
    const isDeafened = !appState.isDeafened;
    appState.isDeafened = isDeafened;
    
    // 다른 사용자들의 오디오 출력 제어
    Object.values(appState.voiceConnections).forEach(conn => {
        if (conn.remoteStream) {
            conn.remoteStream.getAudioTracks().forEach(track => {
                track.enabled = !isDeafened;
            });
        }
    });
    
    // 자신의 마이크도 음소거
    if (appState.localStream) {
        appState.localStream.getAudioTracks().forEach(track => {
            track.enabled = !isDeafened;
        });
    }
    
    // UI 업데이트
    if (UI.deafenBtn) {
        if (isDeafened) {
            UI.deafenBtn.classList.add('active');
            UI.deafenBtn.title = t('undeafen');
            
            // 음소거 버튼도 비활성화 표시
            if (UI.muteBtn) {
                UI.muteBtn.classList.add('active');
                UI.muteBtn.disabled = true;
            }
        } else {
            UI.deafenBtn.classList.remove('active');
            UI.deafenBtn.title = t('deafen');
            
            // 음소거 버튼 다시 활성화
            if (UI.muteBtn) {
                UI.muteBtn.classList.remove('active');
                UI.muteBtn.disabled = false;
            }
        }
    }
    
    // 다른 사용자들에게 상태 알림
    if (appState.currentVoiceChannel) {
        broadcastMessage({
            type: 'voice',
            action: 'deafen_status',
            userId: appState.localUserId,
            isDeafened: isDeafened
        });
    }
}

/**
 * CAPTCHA 생성
 * @return {Object} 생성된 CAPTCHA 데이터
 */
function generateCaptcha() {
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let captcha = '';
    for (let i = 0; i < 6; i++) {
        captcha += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 60;
    const ctx = canvas.getContext('2d');
    
    // 배경색
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // 텍스트 스타일
    ctx.fillStyle = '#333';
    ctx.font = 'bold 30px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // 캡차 텍스트 그리기 (약간 왜곡)
    for (let i = 0; i < captcha.length; i++) {
        const x = 30 + i * 30;
        const y = 30 + Math.sin(i) * 5;
        const angle = (Math.random() - 0.5) * 0.4;
        
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.fillText(captcha.charAt(i), 0, 0);
        ctx.restore();
    }
    
    // 방해선 추가
    ctx.strokeStyle = '#999';
    for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.moveTo(Math.random() * canvas.width, Math.random() * canvas.height);
        ctx.lineTo(Math.random() * canvas.width, Math.random() * canvas.height);
        ctx.stroke();
    }
    
    return {
        text: captcha,
        imageUrl: canvas.toDataURL()
    };
}

/**
 * CAPTCHA 모달 표시
 * @param {Function} callback - 인증 성공 시 호출할 콜백
 */
function showCaptchaModal(callback) {
    if (!UI.captchaModal || !UI.captchaImage || !UI.captchaInput || !UI.verifyCaptchaBtn) {
        console.error('CAPTCHA 모달 요소가 없습니다.');
        if (typeof callback === 'function') {
            callback(true); // 요소가 없으면 실패 처리
        }
        return;
    }
    
    // CAPTCHA 생성
    const captcha = generateCaptcha();
    appState.currentCaptcha = captcha.text;
    
    // 이미지 표시
    UI.captchaImage.src = captcha.imageUrl;
    UI.captchaInput.value = '';
    
    // 확인 버튼 이벤트
    const onVerify = function() {
        const input = UI.captchaInput.value.trim().toUpperCase();
        const isValid = input === captcha.text;
        
        if (isValid) {
            UI.captchaModal.classList.add('hidden');
            appState.captchaVerified = true;
            if (typeof callback === 'function') {
                callback(false); // 성공
            }
        } else {
            // 실패 시 새로운 CAPTCHA 생성
            UI.captchaInput.value = '';
            const newCaptcha = generateCaptcha();
            appState.currentCaptcha = newCaptcha.text;
            UI.captchaImage.src = newCaptcha.imageUrl;
            
            // 오류 메시지 표시
            UI.captchaInput.classList.add('error');
            setTimeout(() => {
                UI.captchaInput.classList.remove('error');
            }, 1000);
        }
    };
    
    // 이벤트 리스너 제거 후 재설정
    UI.verifyCaptchaBtn.removeEventListener('click', onVerify);
    UI.verifyCaptchaBtn.addEventListener('click', onVerify);
    
    // 엔터키 이벤트
    UI.captchaInput.removeEventListener('keypress', onCaptchaKeyPress);
    UI.captchaInput.addEventListener('keypress', onCaptchaKeyPress);
    
    function onCaptchaKeyPress(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            onVerify();
        }
    }
    
    // 모달 표시
    UI.captchaModal.classList.remove('hidden');
    UI.captchaInput.focus();
}

/**
 * 이름 설정 모달 표시
 * @param {Function} callback - 설정 완료 시 호출할 콜백
 */
function showNameSetupModal(callback) {
    if (!UI.nameSetupModal || !UI.nameSetupInput || !UI.saveNameBtn) {
        console.error('이름 설정 모달 요소가 없습니다.');
        if (typeof callback === 'function') {
            callback(); // 요소가 없으면 그냥 진행
        }
        return;
    }
    
    // 기존 이름 채우기
    UI.nameSetupInput.value = appState.localUserName || '';
    
    // 아바타 미리보기 업데이트
    if (UI.nameSetupAvatarPreview && appState.localUserAvatar) {
        UI.nameSetupAvatarPreview.style.backgroundImage = `url(${appState.localUserAvatar})`;
    }
    
    // 아바타 선택 이벤트
    if (UI.nameSetupAvatarInput) {
        UI.nameSetupAvatarInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            // 이미지 파일 확인
            if (!file.type.startsWith('image/')) {
                showToast(t('image_file_only'));
                return;
            }
            
            // 파일 크기 제한 (1MB)
            if (file.size > 1024 * 1024) {
                showToast(t('image_size_limit'));
                return;
            }
            
            // 이미지 미리보기
            const reader = new FileReader();
            reader.onload = function(e) {
                const imageData = e.target.result;
                if (UI.nameSetupAvatarPreview) {
                    UI.nameSetupAvatarPreview.style.backgroundImage = `url(${imageData})`;
                }
                // 임시 저장
                appState.tempAvatar = imageData;
            };
            reader.readAsDataURL(file);
        });
    }
    
    // 저장 버튼 이벤트
    const onSave = function() {
        const name = UI.nameSetupInput.value.trim();
        if (!name) {
            UI.nameSetupInput.classList.add('error');
            setTimeout(() => {
                UI.nameSetupInput.classList.remove('error');
            }, 1000);
            return;
        }
        
        appState.localUserName = name;
        
        // 아바타 적용
        if (appState.tempAvatar) {
            appState.localUserAvatar = appState.tempAvatar;
            delete appState.tempAvatar;
        }
        
        // 설정 저장
        LocalStorage.save('userName', name);
        if (appState.localUserAvatar) {
            LocalStorage.save('userAvatar', appState.localUserAvatar);
        }
        
        UI.nameSetupModal.classList.add('hidden');
        
        if (typeof callback === 'function') {
            callback();
        }
    };
    
    // 이벤트 리스너 제거 후 재설정
    UI.saveNameBtn.removeEventListener('click', onSave);
    UI.saveNameBtn.addEventListener('click', onSave);
    
    // 엔터키 이벤트
    UI.nameSetupInput.removeEventListener('keypress', onNameKeyPress);
    UI.nameSetupInput.addEventListener('keypress', onNameKeyPress);
    
    function onNameKeyPress(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            onSave();
        }
    }
    
    // 모달 표시
    UI.nameSetupModal.classList.remove('hidden');
    UI.nameSetupInput.focus();
}

/**
 * 아바타 표시 업데이트
 * @param {string} avatarUrl - 아바타 이미지 URL
 */
function updateAvatarDisplay(avatarUrl) {
    if (!avatarUrl) return;
    
    // 메인 UI의 아바타 업데이트
    if (UI.userAvatar) {
        UI.userAvatar.style.backgroundImage = `url(${avatarUrl})`;
        UI.userAvatar.style.backgroundColor = 'transparent';
    }
    
    // 사용자 목록에서 자신의 아바타 업데이트
    if (appState.localUserId) {
        const userItems = document.querySelectorAll(`.user-item[data-user-id="${appState.localUserId}"]`);
        userItems.forEach(item => {
            const avatar = item.querySelector('.user-item-avatar');
            if (avatar) {
                avatar.style.backgroundImage = `url(${avatarUrl})`;
                avatar.style.backgroundColor = 'transparent';
            }
        });
    }
}

/**
 * 아바타 요소 업데이트 (재사용 가능한 유틸리티 함수)
 * @param {HTMLElement} element - 아바타 요소
 * @param {string} avatarUrl - 아바타 이미지 URL
 * @param {string} userName - 사용자 이름 (색상 생성용)
 */
function updateAvatarElement(element, avatarUrl, userName) {
    if (!element) return;
    
    if (avatarUrl) {
        element.style.backgroundImage = `url(${escapeHtml(avatarUrl)})`;
        element.style.backgroundColor = 'transparent';
    } else {
        element.style.backgroundImage = '';
        element.style.backgroundColor = getColorFromName(userName || '');
    }
}

/**
 * 사용자 설정 로드
 */
function loadUserSettings() {
    try {
        // 사용자 이름 불러오기
        const savedUserName = LocalStorage.load('userName');
        if (savedUserName) {
            appState.localUserName = savedUserName;
            if (UI.userName) UI.userName.textContent = savedUserName;
            if (UI.userNameModalInput) UI.userNameModalInput.value = savedUserName;
        } else {
            // 기본 사용자 이름 설정
            appState.localUserName = '사용자' + Math.floor(Math.random() * 1000);
            if (UI.userName) UI.userName.textContent = appState.localUserName;
            if (UI.userNameModalInput) UI.userNameModalInput.value = appState.localUserName;
        }
        
        // 사용자 아바타 불러오기
        const savedAvatar = LocalStorage.load('userAvatar');
        if (savedAvatar) {
            appState.localUserAvatar = savedAvatar;
            updateAvatarDisplay(savedAvatar);
        }
        
        // 알림 설정 불러오기
        const notificationSettings = LocalStorage.load('notificationSettings', {
            enabled: true,
            desktop: true,
            sound: true
        });
        
        appState.notifications = {
            ...appState.notifications,
            ...notificationSettings
        };
        
        // 사용자 상태 불러오기
        const savedStatus = LocalStorage.load('userStatus', 'online');
        appState.localUserStatus = savedStatus;
        
        // 어두운 테마 불러오기
        const darkTheme = LocalStorage.load('darkTheme', true);
        if (!darkTheme) {
            document.body.classList.add('light-theme');
        }
        
        // 언어 설정 불러오기
        const savedLanguage = LocalStorage.load('language', LOCALE_DEFAULT);
        appState.language = savedLanguage;
        
        // 보이스 설정 불러오기
        const voiceSettings = LocalStorage.load('voiceSettings', {
            noiseSuppression: true,
            echoCancellation: true
        });
        
        appState.noiseSuppression = voiceSettings.noiseSuppression;
        appState.echoCancellation = voiceSettings.echoCancellation;
        
        // 단축키 설정 불러오기
        const shortcutSettings = LocalStorage.load('shortcutSettings');
        if (shortcutSettings) {
            appState.shortcuts = {
                ...appState.shortcuts,
                ...shortcutSettings
            };
        }
    } catch (error) {
        console.error('사용자 설정 로드 중 오류:', error);
        // 기본값 설정
        appState.localUserName = '사용자' + Math.floor(Math.random() * 1000);
        if (UI.userName) UI.userName.textContent = appState.localUserName;
        if (UI.userNameModalInput) UI.userNameModalInput.value = appState.localUserName;
    }
}

/**
 * URL에서 초대 코드 확인
 */
function checkUrlForInviteCode() {
    try {
        // URL 해시에서 초대 코드 추출 (#으로 시작하는 부분)
        const hash = window.location.hash;
        if (hash && hash.length > 1) {
            // # 이후의 문자열을 초대 코드로 사용
            const inviteCode = hash.substring(1);
            
            // 초대 코드 검증 (4자리 영숫자만 허용)
            if (/^[a-z0-9]{4}$/i.test(inviteCode)) {
                console.log('URL에서 유효한 초대 코드 감지:', inviteCode);
                
                // 초기 모달 숨기기
                if (UI.entryModal) {
                    UI.entryModal.classList.add('hidden');
                }
                
                // 연결 시도
                handleDirectConnection(inviteCode);
            } else {
                console.log('URL에 유효하지 않은 초대 코드:', inviteCode);
            }
        }
    } catch (error) {
        console.warn('URL에서 초대 코드 확인 중 오류:', error);
    }
}

/**
 * 직접 연결 처리 (URL 링크로 접속 시)
 * @param {string} inviteCode - 초대 코드
 */
function handleDirectConnection(inviteCode) {
    // 초대 코드가 유효한지 다시 한 번 확인
    if (!inviteCode || !/^[a-z0-9]{4}$/i.test(inviteCode)) {
        showToast(t('invalid_invite_code') || '유효하지 않은 초대 코드입니다.', 3000, 'error');
        
        // 초기 모달로 돌아가기
        if (UI.entryModal) UI.entryModal.classList.remove('hidden');
        return;
    }

    // 연결 모달 표시
    showConnectionModal();
    updateConnectionStep(1, 'active');
    
    // CAPTCHA 인증 진행
    showCaptchaModal((captchaFailed) => {
        if (captchaFailed) {
            handleConnectionError(t('captcha_failed') || 'CAPTCHA 인증에 실패했습니다.');
            
            // 잠시 후 초기 모달로 돌아가기
            setTimeout(() => {
                if (UI.connectionModal) UI.connectionModal.classList.add('hidden');
                if (UI.entryModal) UI.entryModal.classList.remove('hidden');
            }, 2000);
            return;
        }
        
        // 사용자 이름이 이미 설정되어 있는지 확인
        if (appState.localUserName && appState.localUserName !== `사용자${Math.floor(Math.random() * 1000)}`) {
            // 이름이 이미 설정되어 있으면 바로 방 참여
            joinRoom(inviteCode);
        } else {
            // 이름 설정 모달 표시
            showNameSetupModal(() => {
                // 이름 설정 후 방 참여
                joinRoom(inviteCode);
            });
        }
    });
}

/**
 * 연결 핑 프로세스 시작 (연결 유지)
 * @param {Object} connection - 피어 연결 객체
 */
function startPingProcess(connection) {
    // 이미 핑 프로세스가 있으면 제거
    if (connection.pingInterval) {
        clearInterval(connection.pingInterval);
    }
    
    // 30초마다 핑 메시지 전송
    connection.pingInterval = setInterval(() => {
        try {
            // 연결이 여전히 유효한지 확인
            if (connection.open) {
                sendData(connection, { type: 'ping', timestamp: Date.now() });
            } else {
                // 연결이 닫혔다면 타이머 제거
                clearInterval(connection.pingInterval);
                delete connection.pingInterval;
            }
        } catch (e) {
            console.warn('핑 전송 중 오류:', e);
            // 오류 발생 시 타이머 제거
            clearInterval(connection.pingInterval);
            delete connection.pingInterval;
        }
    }, 30000); // 30초마다
}

// handleReceivedMessage 함수 상단에 추가
// 핑 메시지 처리

function setupConnectionPing(conn) {
    if (!conn) return;
    
    // 이미 설정되어 있으면 제거
    if (conn.pingInterval) {
        clearInterval(conn.pingInterval);
        delete conn.pingInterval;
    }
    
    // 연결 상태 모니터링을 위한 데이터 초기화
    if (!appState.peerConnectionStats[conn.peer]) {
        appState.peerConnectionStats[conn.peer] = {
            lastPingTime: 0,
            lastPongTime: 0,
            latency: 0,
            missedPings: 0,
            totalPings: 0
        };
    }
    
    // 30초마다 핑 메시지 전송
    conn.pingInterval = setInterval(() => {
        try {
            // 연결이 여전히 유효한지 확인
            if (conn.open) {
                const pingTimestamp = Date.now();
                
                // 핑 전송
                sendData(conn, { 
                    type: 'ping', 
                    timestamp: pingTimestamp 
                });
                
                // 통계 업데이트
                appState.peerConnectionStats[conn.peer].lastPingTime = pingTimestamp;
                appState.peerConnectionStats[conn.peer].totalPings++;
                
                // 5초 안에 퐁이 오지 않으면 누락된 핑으로 카운트
                conn.pongTimeout = setTimeout(() => {
                    appState.peerConnectionStats[conn.peer].missedPings++;
                    
                    // 연속으로 3번 핑이 누락되면 연결 재시도
                    if (appState.peerConnectionStats[conn.peer].missedPings >= 3) {
                        console.warn(`피어 ${conn.peer}와의 연결이 불안정합니다. 재연결 시도...`);
                        
                        // 연결 재시도 로직
                        retryConnection(conn.peer);
                        
                        // 카운터 초기화
                        appState.peerConnectionStats[conn.peer].missedPings = 0;
                    }
                }, 5000); // 5초 타임아웃
            } else {
                // 연결이 닫혔다면 타이머 제거
                clearInterval(conn.pingInterval);
                delete conn.pingInterval;
                
                if (conn.pongTimeout) {
                    clearTimeout(conn.pongTimeout);
                    delete conn.pongTimeout;
                }
            }
        } catch (e) {
            console.warn('핑 전송 중 오류:', e);
            
            // 오류 발생 시 타이머 제거
            clearInterval(conn.pingInterval);
            delete conn.pingInterval;
            
            if (conn.pongTimeout) {
                clearTimeout(conn.pongTimeout);
                delete conn.pongTimeout;
            }
        }
    }, 30000); // 30초마다
    
    // 퐁 메시지 처리 함수
    conn.handlePong = function(timestamp, responseTime) {
        // 퐁 타임아웃 취소
        if (conn.pongTimeout) {
            clearTimeout(conn.pongTimeout);
            delete conn.pongTimeout;
        }
        
        // 지연시간 계산
        const latency = Date.now() - timestamp;
        
        // 통계 업데이트
        if (appState.peerConnectionStats[conn.peer]) {
            appState.peerConnectionStats[conn.peer].latency = latency;
            appState.peerConnectionStats[conn.peer].lastPongTime = Date.now();
            
            // 누락된 핑 카운터 리셋
            appState.peerConnectionStats[conn.peer].missedPings = 0;
        }
        
        // 디버깅용 로그 (매우 높은 지연시간일 경우)
        if (latency > 1000) {
            console.warn(`피어 ${conn.peer}와의 높은 지연시간 감지: ${latency}ms`);
        }
    };
    
    // 원래 data 이벤트 핸들러를 백업
    const originalDataHandler = conn.dataCallbacks._callbacks.data;
    
    // data 이벤트에 퐁 처리 로직 추가
    conn.dataCallbacks._callbacks.data = function(data) {
        // 퐁 메시지인 경우 특별 처리
        if (data && data.type === 'pong' && data.timestamp) {
            conn.handlePong(data.timestamp, data.responseTime);
        }
        
        // 원래 핸들러 호출 (다른 메시지 처리)
        if (originalDataHandler && originalDataHandler.length > 0) {
            originalDataHandler.forEach(handler => {
                handler(data);
            });
        }
    };
    
    console.log(`피어 ${conn.peer}에 핑/퐁 메커니즘 설정 완료`);
}




function retryConnection(peerId) {
    // 이미 연결이 있으면 제거
    if (appState.connections[peerId]) {
        appState.connections[peerId].close();
        delete appState.connections[peerId];
    }
    setTimeout(() => {
        // 새 연결 시도
        if (appState.peer && !appState.peer.disconnected) {
            connectToPeer(peerId);
        }
    }, 1000);
}
/**
 * 이벤트 리스너 설정
 */
function setupEventListeners() {
    try {
        // 진입 모달 이벤트
        if (UI.createRoomModalBtn) {
            UI.createRoomModalBtn.addEventListener('click', () => {
                // CAPTCHA 인증
                showCaptchaModal((captchaFailed) => {
                    if (captchaFailed) {
                        showToast(t('captcha_failed'));
                        return;
                    }
                    
                    const userName = UI.userNameModalInput && UI.userNameModalInput.value.trim() 
                        ? UI.userNameModalInput.value.trim() 
                        : appState.localUserName;
                    saveUserName(userName);
                    createRoom();
                });
            });
        }
        
        if (UI.joinRoomModalBtn && UI.joinCodeModalInput) {
            UI.joinRoomModalBtn.addEventListener('click', () => {
                const code = UI.joinCodeModalInput.value.trim();
                
                if (!code) {
                    showToast(t('enter_invite_code'));
                    return;
                }
                
                // CAPTCHA 인증
                showCaptchaModal((captchaFailed) => {
                    if (captchaFailed) {
                        showToast(t('captcha_failed'));
                        return;
                    }
                    
                    const userName = UI.userNameModalInput && UI.userNameModalInput.value.trim() 
                        ? UI.userNameModalInput.value.trim() 
                        : appState.localUserName;
                    saveUserName(userName);
                    joinRoom(code);
                });
            });
        }
        
        // 모달 엔터키 처리
        if (UI.joinCodeModalInput) {
            UI.joinCodeModalInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    if (UI.joinRoomModalBtn) UI.joinRoomModalBtn.click();
                }
            });
        }
        
        if (UI.userNameModalInput) {
            UI.userNameModalInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    // 초대 코드가 있으면 참여, 없으면 방 생성
                    if (UI.joinCodeModalInput && UI.joinCodeModalInput.value.trim()) {
                        if (UI.joinRoomModalBtn) UI.joinRoomModalBtn.click();
                    } else {
                        if (UI.createRoomModalBtn) UI.createRoomModalBtn.click();
                    }
                }
            });
        }
        
        // 초대 모달 관련
        if (UI.inviteBtn) {
            UI.inviteBtn.addEventListener('click', showInviteModal);
        }
        
        if (UI.closeInviteModal && UI.inviteModal) {
            UI.closeInviteModal.addEventListener('click', () => {
                UI.inviteModal.classList.add('hidden');
            });
        }
        
        if (UI.copyInviteBtn && UI.inviteCode) {
            UI.copyInviteBtn.addEventListener('click', () => {
                copyToClipboard(UI.inviteCode.textContent || '');
                showToast(t('copied_invite_code'));
            });
        }
        
        if (UI.copyLinkBtn && UI.inviteLink) {
            UI.copyLinkBtn.addEventListener('click', () => {
                copyToClipboard(UI.inviteLink.textContent || '');
                showToast(t('copied_invite_link'));
            });
        }
        
        // 연결 재시도 버튼
        if (UI.retryConnectionBtn && UI.connectionError) {
            UI.retryConnectionBtn.addEventListener('click', () => {
                UI.connectionError.classList.add('hidden');
                
                // 현재 상태에 따라 재시도
                if (appState.isHost) {
                    createRoom();
                } else if (appState.roomId) {
                    joinRoom(appState.roomId);
                }
            });
        }
        
        // 사용자 메뉴 이벤트
        const userInfo = document.getElementById('userInfo');
        if (userInfo) {
            userInfo.addEventListener('click', showProfileModal);
        }
        
        // 프로필 모달 이벤트
        const closeProfileModal = document.getElementById('closeProfileModal');
        if (closeProfileModal) {
            closeProfileModal.addEventListener('click', () => {
                const profileModal = document.getElementById('profileModal');
                if (profileModal) profileModal.classList.add('hidden');
            });
        }
        
        // 아바타 변경 이벤트
        const changeAvatarBtn = document.getElementById('changeAvatarBtn');
        const avatarInput = document.getElementById('avatarInput');
        if (changeAvatarBtn && avatarInput) {
            changeAvatarBtn.addEventListener('click', () => {
                avatarInput.click();
            });
            
            avatarInput.addEventListener('change', handleAvatarChange);
        }
        
        // 프로필 저장 이벤트
        const saveProfileBtn = document.getElementById('saveProfileBtn');
        if (saveProfileBtn) {
            saveProfileBtn.addEventListener('click', saveProfile);
        }
        
        // 알림 설정 이벤트
        const notificationToggle = document.getElementById('notificationToggle');
        if (notificationToggle) {
            notificationToggle.addEventListener('change', (e) => {
                appState.notifications.desktop = e.target.checked;
                saveNotificationSettings();
            });
        }
        
        // 소리 알림 설정 이벤트
        const soundToggle = document.getElementById('soundToggle');
        if (soundToggle) {
            soundToggle.addEventListener('change', (e) => {
                appState.notifications.sound = e.target.checked;
                saveNotificationSettings();
            });
        }
        
        // 알림 권한 요청 이벤트
        const requestPermissionBtn = document.getElementById('requestPermissionBtn');
        if (requestPermissionBtn) {
            requestPermissionBtn.addEventListener('click', requestNotificationPermission);
        }
        
        // 채널 추가 아이콘 이벤트
        if (UI.addChannelIcon) {
            UI.addChannelIcon.addEventListener('click', () => {
                if (appState.isHost || appState.isAdmin) {
                    showAddChannelPrompt('text');
                } else {
                    showToast(t('no_channel_permission'));
                }
            });
        }
        
        // 음성 채널 추가 아이콘 이벤트
        if (UI.addVoiceChannelIcon) {
            UI.addVoiceChannelIcon.addEventListener('click', () => {
                if (appState.isHost || appState.isAdmin) {
                    showAddChannelPrompt('voice');
                } else {
                    showToast(t('no_channel_permission'));
                }
            });
        }
        
        // 관리자 모달 이벤트
        const closeAdminModal = document.getElementById('closeAdminModal');
        if (closeAdminModal) {
            closeAdminModal.addEventListener('click', () => {
                const adminModal = document.getElementById('adminModal');
                if (adminModal) adminModal.classList.add('hidden');
            });
        }
        
        // 채널 추가 이벤트
        const addChannelBtn = document.getElementById('addChannelBtn');
        const newChannelInput = document.getElementById('newChannelInput');
        if (addChannelBtn && newChannelInput) {
            addChannelBtn.addEventListener('click', () => {
                const channelName = newChannelInput.value.trim();
                if (channelName) {
                    addChannel(channelName);
                    newChannelInput.value = '';
                }
            });
            
            newChannelInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && addChannelBtn) {
                    addChannelBtn.click();
                }
            });
        }
        
        // 사용자 관리 모달 이벤트
        const closeUserManageModal = document.getElementById('closeUserManageModal');
        if (closeUserManageModal) {
            closeUserManageModal.addEventListener('click', () => {
                const userManageModal = document.getElementById('userManageModal');
                if (userManageModal) userManageModal.classList.add('hidden');
            });
        }
        
        // 방장 이임 모달 이벤트
        const closeTransferOwnerModal = document.getElementById('closeTransferOwnerModal');
        if (closeTransferOwnerModal) {
            closeTransferOwnerModal.addEventListener('click', () => {
                const transferOwnerModal = document.getElementById('transferOwnerModal');
                if (transferOwnerModal) transferOwnerModal.classList.add('hidden');
            });
        }
        
        // 방장 이임 버튼 이벤트
        const transferOwnerBtn = document.getElementById('transferOwnerBtn');
        if (transferOwnerBtn) {
            transferOwnerBtn.addEventListener('click', showTransferOwnerModal);
        }
        
        // 보이스 설정 모달 이벤트
        const closeVoiceSettingsModal = document.getElementById('closeVoiceSettingsModal');
        if (closeVoiceSettingsModal) {
            closeVoiceSettingsModal.addEventListener('click', () => {
                const voiceSettingsModal = document.getElementById('voiceSettingsModal');
                if (voiceSettingsModal) voiceSettingsModal.classList.add('hidden');
            });
        }
        
        // 보이스 설정 저장 이벤트
        const saveVoiceSettingsBtn = document.getElementById('saveVoiceSettingsBtn');
        if (saveVoiceSettingsBtn) {
            saveVoiceSettingsBtn.addEventListener('click', saveVoiceSettings);
        }
        
        // 잡음 제거 설정 이벤트
        if (UI.noiseSuppressionToggle) {
            UI.noiseSuppressionToggle.addEventListener('change', (e) => {
                appState.noiseSuppression = e.target.checked;
                
                // 현재 활성화된 보이스 스트림이 있다면 설정 적용
                if (appState.localStream) {
                    restartAudioStream();
                }
            });
        }
        
        // 에코 제거 설정 이벤트
        if (UI.echoCancellationToggle) {
            UI.echoCancellationToggle.addEventListener('change', (e) => {
                appState.echoCancellation = e.target.checked;
                
                // 현재 활성화된 보이스 스트림이 있다면 설정 적용
                if (appState.localStream) {
                    restartAudioStream();
                }
            });
        }
        
        // 언어 선택 이벤트
        if (UI.languageSelector) {
            UI.languageSelector.addEventListener('change', (e) => {
                const lang = e.target.value;
                changeLanguage(lang);
            });
        }
        
        // 사용자 관리 버튼 이벤트
        setupUserManagementButtons();
        
        // 채팅 관련
        if (UI.sendMessageBtn) {
            UI.sendMessageBtn.addEventListener('click', sendChatMessage);
        }
        
        if (UI.messageInput) {
            UI.messageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendChatMessage();
                } else {
                    // 타이핑 상태 전송
                    sendTypingStatus(true);
                }
            });
            
            // 타이핑 상태 종료 감지
            UI.messageInput.addEventListener('blur', () => {
                sendTypingStatus(false);
            });
        }
        
        // 파일 전송
        if (UI.fileInput) {
            UI.fileInput.addEventListener('change', handleFileSelection);
        }
        
        // 상태 선택기 이벤트
        if (UI.statusSelector) {
            UI.statusSelector.addEventListener('change', (e) => {
                const newStatus = e.target.value;
                changeUserStatus(newStatus);
            });
        }
        
        // 테마 변경 이벤트
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.addEventListener('change', toggleTheme);
        }
        
        // 채널 컨텍스트 메뉴 설정
        setupChannelContextMenu();
        
        // 창 닫기 이벤트
        window.addEventListener('beforeunload', () => {
            // 음성 채널에 연결된 경우 종료
            if (appState.currentVoiceChannel) {
                leaveVoiceChannel();
            }
            
            // 연결된 모든 피어들에게 연결 종료 메시지 전송
            Object.values(appState.connections).forEach(conn => {
                try {
                    sendData(conn, {
                        type: 'system',
                        action: 'peer_disconnect',
                        userId: appState.localUserId,
                        userName: appState.localUserName
                    });
                } catch (e) {
                    console.error('연결 종료 메시지 전송 실패:', e);
                }
            });
            
            // PeerJS 연결 종료
            if (appState.peer) {
                appState.peer.destroy();
            }
        });
        
        // 문서 가시성 변경 이벤트 (탭 전환 감지)
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                // 창이 활성화되면 새 메시지 표시기 초기화
                document.title = `cchat - 채팅방 #${appState.roomId || ''}`;
                
                // 상태를 온라인으로 변경 (자리비움이었던 경우)
                if (appState.localUserStatus === 'away') {
                    changeUserStatus('online');
                }
            } else {
                // 창이 비활성화되면 일정 시간 후 자리비움으로 변경
                setTimeout(() => {
                    if (document.visibilityState !== 'visible' && appState.localUserStatus === 'online') {
                        changeUserStatus('away');
                    }
                }, 60000); // 1분 후
            }
        });
        
        // 네트워크 상태 이벤트
        window.addEventListener('online', () => {
            showToast(t('internet_connected'));
            
            // 재연결 시도
            if (appState.connectionEstablished && appState.peer) {
                if (appState.peer.disconnected) {
                    appState.peer.reconnect();
                }
            }
        });
        
        window.addEventListener('offline', () => {
            showToast(t('internet_disconnected'), 0, 'error');
            updateConnectionStatus(t('connection_lost'), 'disconnected');
        });
    } catch (error) {
        console.error('이벤트 리스너 설정 중 오류:', error);
        showToast(t('init_error'), 0, 'error');
    }
}

/**
 * 보이스 설정 저장
 */
function saveVoiceSettings() {
    try {
        const voiceSettings = {
            noiseSuppression: appState.noiseSuppression,
            echoCancellation: appState.echoCancellation
        };
        
        LocalStorage.save('voiceSettings', voiceSettings);
        
        // 현재 활성화된 보이스 스트림이 있다면 설정 적용
        if (appState.localStream) {
            restartAudioStream();
        }
        
        // 모달 닫기
        const voiceSettingsModal = document.getElementById('voiceSettingsModal');
        if (voiceSettingsModal) voiceSettingsModal.classList.add('hidden');
        
        showToast(t('settings_saved'));
    } catch (error) {
        console.error('보이스 설정 저장 중 오류:', error);
        showToast(t('settings_save_error'), 3000, 'error');
    }
}

/**
 * 오디오 스트림 재시작 (설정 변경 시)
 */
function restartAudioStream() {
    try {
        // 현재 연결된 음성 채널 저장
        const currentChannel = appState.currentVoiceChannel;
        
        // 현재 모든 연결 종료
        leaveVoiceChannel();
        
        // 잠시 후 다시 연결
        setTimeout(() => {
            if (currentChannel) {
                joinVoiceChannel(currentChannel);
            }
        }, 500);
    } catch (error) {
        console.error('오디오 스트림 재시작 중 오류:', error);
    }
}

/**
 * 언어 변경
 * @param {string} lang - 언어 코드
 */
function changeLanguage(lang) {
    if (lang === appState.language) return;
    
    appState.language = lang;
    LocalStorage.save('language', lang);
    
    // 언어 데이터 로드
    loadLanguage(lang);
    
    showToast(t('language_changed'));
}

/**
 * 방장 이임 모달 표시
 */
function showTransferOwnerModal() {
    try {
        // 방장이 아니면 표시하지 않음
        if (!appState.isHost) {
            showToast(t('not_host'));
            return;
        }
        
        const transferOwnerModal = document.getElementById('transferOwnerModal');
        const transferOwnerList = document.getElementById('transferOwnerList');
        
        if (!transferOwnerModal || !transferOwnerList) return;
        
        // 사용자 목록 초기화
        transferOwnerList.innerHTML = '';
        
        // 사용자 목록 생성 (방장, 자신 제외)
        Object.entries(appState.users).forEach(([userId, user]) => {
            if (userId !== appState.localUserId && user.role !== 'host') {
                const userItem = document.createElement('div');
                userItem.className = 'transfer-user-item';
                
                // 아바타 배경 설정
                let avatarStyle = '';
                if (user.avatar) {
                    avatarStyle = `background-image: url(${escapeHtml(user.avatar)}); background-color: transparent;`;
                } else {
                    const userColor = getColorFromName(user.name);
                    avatarStyle = `background-color: ${userColor};`;
                }
                
                userItem.innerHTML = `
                    <div class="transfer-user-avatar" style="${avatarStyle}"></div>
                    <div class="transfer-user-name">${escapeHtml(user.name)}</div>
                    <button class="transfer-button" data-user-id="${userId}">${t('transfer')}</button>
                `;
                
                transferOwnerList.appendChild(userItem);
            }
        });
        
        // 이임 버튼 이벤트 설정
        transferOwnerList.querySelectorAll('.transfer-button').forEach(button => {
            button.addEventListener('click', (e) => {
                const userId = e.target.dataset.userId;
                if (userId) {
                    transferOwnership(userId);
                    transferOwnerModal.classList.add('hidden');
                }
            });
        });
        
        // 모달 표시
        transferOwnerModal.classList.remove('hidden');
    } catch (error) {
        console.error('방장 이임 모달 표시 중 오류:', error);
    }
}

/**
 * 방장 권한 이임
 * @param {string} newOwnerId - 새 방장 ID
 */
function transferOwnership(newOwnerId) {
    try {
        // 방장이 아니면 이임 불가
        if (!appState.isHost) {
            showToast(t('not_host'));
            return;
        }
        
        // 새 방장 확인
        if (!appState.users[newOwnerId]) {
            showToast(t('user_not_found'));
            return;
        }
        
        const newOwnerName = appState.users[newOwnerId].name;
        
        // 호스트 변경 메시지 브로드캐스트
        broadcastMessage({
            type: 'system',
            action: 'host_transfer',
            currentHostId: appState.localUserId,
            newHostId: newOwnerId,
            newHostName: newOwnerName
        });
        
        // 자신의 권한 변경
        appState.isHost = false;
        if (appState.users[appState.localUserId]) {
            appState.users[appState.localUserId].role = 'admin'; // 이임 후에는 관리자로 변경
        }
        
        // 새 방장 권한 변경
        if (appState.users[newOwnerId]) {
            appState.users[newOwnerId].role = 'host';
        }
        
        // UI 업데이트
        updateUsersList();
        
        // 시스템 메시지 표시
        addSystemMessage(t('ownership_transferred', { user: newOwnerName }));
        showToast(t('ownership_transferred', { user: newOwnerName }));
    } catch (error) {
        console.error('방장 권한 이임 중 오류:', error);
    }
}

/**
 * 보이스 채널 참여
 * @param {string} channelId - 음성 채널 ID
 */
function joinVoiceChannel(channelId) {
    try {
        // 이미 다른 음성 채널에 참여 중인 경우 먼저 나가기
        if (appState.currentVoiceChannel) {
            leaveVoiceChannel();
        }
        
        // 채널 유효성 검사
        if (!appState.voiceChannels[channelId]) {
            showToast(t('voice_channel_not_found'));
            return;
        }
        
        console.log(`음성 채널 참여: ${channelId}`);
        
        // WebRTC 지원 여부 확인
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            showToast(t('webrtc_not_supported') || '음성 채팅이 지원되지 않는 브라우저입니다.', 3000, 'error');
            console.error('WebRTC is not supported in this browser');
            return;
        }
        
        // 마이크 권한 요청
        navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: appState.echoCancellation,
                noiseSuppression: appState.noiseSuppression,
                autoGainControl: true
            },
            video: false
        })
        .then(stream => {
            appState.localStream = stream;
            appState.currentVoiceChannel = channelId;
            
            // 채널에 자신을 추가
            if (!appState.voiceChannels[channelId].users.includes(appState.localUserId)) {
                appState.voiceChannels[channelId].users.push(appState.localUserId);
            }
            
            // 음성 컨트롤 표시
            if (UI.voiceControls) {
                UI.voiceControls.classList.remove('hidden');
            }
            
            // 다른 사용자들에게 참여 알림
            broadcastMessage({
                type: 'voice',
                action: 'join_channel',
                userId: appState.localUserId,
                userName: appState.localUserName,
                channelId: channelId
            });
            
            // 채널에 있는 다른 사용자들과 연결
            appState.voiceChannels[channelId].users.forEach(userId => {
                if (userId !== appState.localUserId) {
                    createVoiceConnection(userId);
                }
            });
            
            // 음성 채널 UI 업데이트
            updateVoiceChannelsList();
            
            // 효과음 재생
            playNotificationSound('voice_join');
            
            // 시스템 메시지 표시
            const channelName = appState.voiceChannels[channelId].name;
            addSystemMessage(t('voice_joined', { channel: channelName }));
        })
        .catch(error => {
            console.error('마이크 권한 요청 중 오류:', error);
            showToast(t('microphone_permission_error') || '마이크 권한이 필요합니다.', 0, 'error');
        });
    } catch (error) {
        console.error('보이스 채널 참여 중 오류:', error);
    }
}

/**
 * 보이스 채널 나가기
 */
function leaveVoiceChannel() {
    try {
        if (!appState.currentVoiceChannel) return;
        
        const channelId = appState.currentVoiceChannel;
        console.log(`음성 채널 나가기: ${channelId}`);
        
        // 다른 사용자들에게 나감 알림
        broadcastMessage({
            type: 'voice',
            action: 'leave_channel',
            userId: appState.localUserId,
            channelId: channelId
        });
        
        // 채널에서 자신을 제거
        if (appState.voiceChannels[channelId]) {
            appState.voiceChannels[channelId].users = 
                appState.voiceChannels[channelId].users.filter(id => id !== appState.localUserId);
        }
        
        // 음성 연결 종료
        Object.values(appState.voiceConnections).forEach(conn => {
            if (conn.mediaConnection) {
                conn.mediaConnection.close();
            }
        });
        appState.voiceConnections = {};
        
        // 로컬 스트림 종료
        if (appState.localStream) {
            appState.localStream.getTracks().forEach(track => track.stop());
            appState.localStream = null;
        }
        
        // 상태 초기화
        appState.currentVoiceChannel = null;
        appState.isDeafened = false;
        
        // 음성 컨트롤 숨김
        if (UI.voiceControls) {
            UI.voiceControls.classList.add('hidden');
        }
        
        // 음성 채널 UI 업데이트
        updateVoiceChannelsList();
        
        // 효과음 재생
        playNotificationSound('voice_leave');
        
        // 시스템 메시지 표시
        const channelName = appState.voiceChannels[channelId]?.name || channelId;
        addSystemMessage(t('voice_left', { channel: channelName }));
    } catch (error) {
        console.error('보이스 채널 나가기 중 오류:', error);
    }
}

/**
 * 음성 연결 생성
 * @param {string} peerId - 상대방 피어 ID
 */
function createVoiceConnection(peerId) {
    try {
        if (!appState.peer || !appState.localStream) return;
        
        console.log(`음성 연결 생성: ${peerId}`);
        
        // 이미 연결이 있으면 무시
        if (appState.voiceConnections[peerId] && appState.voiceConnections[peerId].mediaConnection) {
            return;
        }
        
        // 음성 연결 생성
        const mediaConnection = appState.peer.call(peerId, appState.localStream);
        
        // 연결 정보 저장
        appState.voiceConnections[peerId] = {
            mediaConnection: mediaConnection,
            remoteStream: null
        };
        
        // 음성 데이터 수신
        mediaConnection.on('stream', remoteStream => {
            console.log(`음성 스트림 수신: ${peerId}`);
            appState.voiceConnections[peerId].remoteStream = remoteStream;
            
            // 헤드셋 상태에 따라 초기 음소거
            if (appState.isDeafened) {
                remoteStream.getAudioTracks().forEach(track => {
                    track.enabled = false;
                });
            }
            
            // 오디오 요소 생성 및 재생
            const audioEl = new Audio();
            audioEl.srcObject = remoteStream;
            audioEl.autoplay = true;
            
            // 연결 정보에 오디오 요소 저장
            appState.voiceConnections[peerId].audioElement = audioEl;
            
            // 음성 사용자 UI 업데이트
            updateVoiceUsers();
        });
        
        // 연결 종료 이벤트
        mediaConnection.on('close', () => {
            console.log(`음성 연결 종료: ${peerId}`);
            
            // 연결 정보에서 제거
            delete appState.voiceConnections[peerId];
            
            // 음성 사용자 UI 업데이트
            updateVoiceUsers();
        });
        
        mediaConnection.on('error', err => {
            console.error(`음성 연결 오류: ${peerId}`, err);
        });
    } catch (error) {
        console.error('음성 연결 생성 중 오류:', error);
    }
}

/**
 * 음성 채널 목록 업데이트
 */
function updateVoiceChannelsList() {
    try {
        if (!UI.voiceChannelsList) return;
        
        // 기존 항목 제거
        UI.voiceChannelsList.innerHTML = '';
        
        // 음성 채널 목록 생성
        Object.entries(appState.voiceChannels).forEach(([channelId, channel]) => {
            const channelDiv = document.createElement('div');
            channelDiv.className = 'voice-channel';
            channelDiv.dataset.channel = channelId;
            
            if (channelId === appState.currentVoiceChannel) {
                channelDiv.classList.add('active');
            }
            
            // 사용자 수 표시
            const userCount = channel.users ? channel.users.length : 0;
            
            channelDiv.innerHTML = `
                <div class="voice-channel-icon">🔊</div>
                <div class="voice-channel-info">
                    <div class="voice-channel-name">${escapeHtml(channel.name)}</div>
                    <div class="voice-channel-users">${userCount}명</div>
                </div>
                <div class="voice-channel-actions">
                    ${channelId === appState.currentVoiceChannel ? 
                        '<button class="voice-leave-btn" title="나가기">✕</button>' : 
                        '<button class="voice-join-btn" title="참여하기">▶</button>'}
                </div>
            `;
            
            // 채널 클릭 이벤트
            channelDiv.addEventListener('click', () => {
                if (channelId === appState.currentVoiceChannel) {
                    // 현재 참여 중인 채널이면 나가기
                    leaveVoiceChannel();
                } else {
                    // 다른 채널이면 참여
                    joinVoiceChannel(channelId);
                }
            });
            
            // 나가기/참여 버튼 이벤트
            const leaveBtn = channelDiv.querySelector('.voice-leave-btn');
            if (leaveBtn) {
                leaveBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    leaveVoiceChannel();
                });
            }
            
            const joinBtn = channelDiv.querySelector('.voice-join-btn');
            if (joinBtn) {
                joinBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    joinVoiceChannel(channelId);
                });
            }
            
            UI.voiceChannelsList.appendChild(channelDiv);
        });
    } catch (error) {
        console.error('음성 채널 목록 업데이트 중 오류:', error);
    }
}

/**
 * 음성 채널 참여자 목록 업데이트
 */
function updateVoiceUsers() {
    try {
        if (!UI.voiceUsers || !appState.currentVoiceChannel) return;
        
        const channelId = appState.currentVoiceChannel;
        const channel = appState.voiceChannels[channelId];
        
        if (!channel) return;
        
        // 기존 항목 제거
        UI.voiceUsers.innerHTML = '';
        
        // 사용자 목록 생성
        channel.users.forEach(userId => {
            const user = appState.users[userId];
            if (!user) return;
            
            const userDiv = document.createElement('div');
            userDiv.className = 'voice-user';
            userDiv.dataset.userId = userId;
            
            // 자신인지 확인
            const isMe = userId === appState.localUserId;
            
            // 음성 상태 확인
            const isMuted = isMe ? 
                (!appState.localStream || !appState.localStream.getAudioTracks()[0].enabled) :
                (appState.voiceConnections[userId]?.isMuted || false);
            
            // 아바타 배경 설정
            let avatarStyle = '';
            if (user.avatar) {
                avatarStyle = `background-image: url(${escapeHtml(user.avatar)}); background-color: transparent;`;
            } else {
                const userColor = getColorFromName(user.name);
                avatarStyle = `background-color: ${userColor};`;
            }
            
            userDiv.innerHTML = `
                <div class="voice-user-avatar" style="${avatarStyle}"></div>
                <div class="voice-user-name">${escapeHtml(user.name)}${isMe ? ' (나)' : ''}</div>
                <div class="voice-user-status">
                    ${isMuted ? 
                        '<span class="voice-status-icon muted" title="음소거됨">🔇</span>' : 
                        '<span class="voice-status-icon speaking" title="말하는 중">🔊</span>'}
                </div>
            `;
            
            UI.voiceUsers.appendChild(userDiv);
        });
    } catch (error) {
        console.error('음성 채널 참여자 목록 업데이트 중 오류:', error);
    }
}

/**
 * 사용자 관리 버튼 설정
 */
function setupUserManagementButtons() {
    try {
        const giveAdminBtn = document.getElementById('giveAdminBtn');
        const removeAdminBtn = document.getElementById('removeAdminBtn');
        const timeoutUserBtn = document.getElementById('timeoutUserBtn');
        const kickUserBtn = document.getElementById('kickUserBtn');
        const banUserBtn = document.getElementById('banUserBtn');
        
        if (giveAdminBtn) {
            giveAdminBtn.addEventListener('click', () => {
                const userId = giveAdminBtn.dataset.userId;
                if (userId && (appState.isHost || appState.isAdmin)) {
                    // 관리자 권한 부여
                    broadcastMessage({
                        type: 'admin',
                        action: 'promote',
                        targetId: userId,
                        fromId: appState.localUserId,
                        fromName: appState.localUserName
                    });
                    
                    safeGetElement('userManageModal', (modal) => modal.classList.add('hidden'));
                    showToast(t('admin_permission_granted'));
                }
            });
        }
        
        if (removeAdminBtn) {
            removeAdminBtn.addEventListener('click', () => {
                const userId = removeAdminBtn.dataset.userId;
                if (userId && (appState.isHost || appState.isAdmin)) {
                    // 관리자 권한 제거
                    broadcastMessage({
                        type: 'admin',
                        action: 'demote',
                        targetId: userId,
                        fromId: appState.localUserId,
                        fromName: appState.localUserName
                    });
                    
                    safeGetElement('userManageModal', (modal) => modal.classList.add('hidden'));
                    showToast(t('admin_permission_removed'));
                }
            });
        }
        
        if (timeoutUserBtn) {
            timeoutUserBtn.addEventListener('click', () => {
                const userId = timeoutUserBtn.dataset.userId;
                if (userId && (appState.isHost || appState.isAdmin)) {
                    // 타임아웃 (5분)
                    broadcastMessage({
                        type: 'admin',
                        action: 'timeout',
                        targetId: userId,
                        duration: 5, // 5분
                        fromId: appState.localUserId,
                        fromName: appState.localUserName
                    });
                    
                    safeGetElement('userManageModal', (modal) => modal.classList.add('hidden'));
                    showToast(t('user_timeout', { minutes: 5 }));
                }
            });
        }
        
        if (kickUserBtn) {
            kickUserBtn.addEventListener('click', () => {
                const userId = kickUserBtn.dataset.userId;
                if (userId && (appState.isHost || appState.isAdmin)) {
                    // 강퇴
                    broadcastMessage({
                        type: 'admin',
                        action: 'kick',
                        targetId: userId,
                        fromId: appState.localUserId,
                        fromName: appState.localUserName
                    });
                    
                    safeGetElement('userManageModal', (modal) => modal.classList.add('hidden'));
                    showToast(t('user_kicked'));
                }
            });
        }
        
        if (banUserBtn) {
            banUserBtn.addEventListener('click', () => {
                const userId = banUserBtn.dataset.userId;
                if (userId && (appState.isHost || appState.isAdmin)) {
                    // 차단
                    appState.bannedUsers[userId] = true;
                    
                    broadcastMessage({
                        type: 'admin',
                        action: 'ban',
                        targetId: userId,
                        fromId: appState.localUserId,
                        fromName: appState.localUserName
                    });
                    
                    safeGetElement('userManageModal', (modal) => modal.classList.add('hidden'));
                    showToast(t('user_banned'));
                }
            });
        }
    } catch (error) {
        console.error('사용자 관리 버튼 설정 중 오류:', error);
    }
}

/**
 * 채널 컨텍스트 메뉴 설정
 */
function setupChannelContextMenu() {
    try {
        // 채널 목록에 우클릭 이벤트 추가
        if (UI.channelsList) {
            UI.channelsList.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                
                // 클릭한 요소가 채널인지 확인
                const channelDiv = e.target.closest('.channel');
                if (!channelDiv) return;
                
                const channelId = channelDiv.dataset.channel;
                
                // 기본 채널은 삭제 불가
                if (channelId === 'general') {
                    showToast(t('cannot_delete_general'));
                    return;
                }
                
                // 관리자 권한 확인
                if (!appState.isHost && !appState.isAdmin) {
                    showToast(t('no_channel_permission'));
                    return;
                }
                
                // 확인 다이얼로그
                if (confirm(t('confirm_delete_channel', { name: appState.channels[channelId].name }))) {
                    deleteChannel(channelId);
                }
            });
        }
        
        // 음성 채널 목록에 우클릭 이벤트 추가
        if (UI.voiceChannelsList) {
            UI.voiceChannelsList.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                
                // 클릭한 요소가 채널인지 확인
                const channelDiv = e.target.closest('.voice-channel');
                if (!channelDiv) return;
                
                const channelId = channelDiv.dataset.channel;
                
                // 기본 채널은 삭제 불가
                if (channelId === 'voice-general') {
                    showToast(t('cannot_delete_general_voice'));
                    return;
                }
                
                // 관리자 권한 확인
                if (!appState.isHost && !appState.isAdmin) {
                    showToast(t('no_channel_permission'));
                    return;
                }
                
                // 확인 다이얼로그
                if (confirm(t('confirm_delete_voice_channel', { name: appState.voiceChannels[channelId].name }))) {
                    deleteVoiceChannel(channelId);
                }
            });
        }
    } catch (error) {
        console.error('채널 컨텍스트 메뉴 설정 중 오류:', error);
    }
}

/**
 * 사용자 관리 모달 표시
 * @param {string} userId - 관리할 사용자 ID
 */
function showUserManageModal(userId) {
    try {
        // 사용자 정보 확인
        if (!appState.users[userId]) return;
        
        const user = appState.users[userId];
        const managedUserName = document.getElementById('managedUserName');
        const userManageInfo = document.getElementById('userManageInfo');
        
        // 관리자 권한 확인
        if (!appState.isHost && !appState.isAdmin) {
            showToast(t('no_user_management_permission'));
            return;
        }
        
        // 사용자 정보 표시
        if (managedUserName) {
            managedUserName.textContent = `${user.name} 관리`;
        }
        
        // 사용자 역할 정보
        let roleInfo = t('user_role_user');
        if (user.role === 'host') {
            roleInfo = t('user_role_host');
        } else if (user.role === 'admin') {
            roleInfo = t('user_role_admin');
        }
        
        if (userManageInfo) {
            userManageInfo.innerHTML = `
                <p><strong>${t('role')}:</strong> ${roleInfo}</p>
                <p><strong>${t('status')}:</strong> ${getUserStatusText(user.status)}</p>
            `;
        }
        
        // 버튼 데이터 설정
        const buttons = [
            document.getElementById('giveAdminBtn'),
            document.getElementById('removeAdminBtn'),
            document.getElementById('timeoutUserBtn'),
            document.getElementById('kickUserBtn'),
            document.getElementById('banUserBtn')
        ];
        
        buttons.forEach(btn => {
            if (btn) btn.dataset.userId = userId;
        });
        
        // 버튼 상태 설정
        const giveAdminBtn = document.getElementById('giveAdminBtn');
        const removeAdminBtn = document.getElementById('removeAdminBtn');
        
        if (giveAdminBtn) {
            // 이미 관리자인 경우 숨김
            giveAdminBtn.style.display = (user.role === 'admin') ? 'none' : 'block';
        }
        
        if (removeAdminBtn) {
            // 관리자가 아닌 경우 숨김
            removeAdminBtn.style.display = (user.role === 'admin') ? 'block' : 'none';
        }
        
        // 방장은 관리 불가
        const actionButtons = document.querySelectorAll('.admin-action-btn');
        actionButtons.forEach(btn => {
            btn.disabled = (user.role === 'host');
        });
        
        // 모달 표시
        safeGetElement('userManageModal', (modal) => modal.classList.remove('hidden'));
    } catch (error) {
        console.error('사용자 관리 모달 표시 중 오류:', error);
        showToast(t('user_management_error'), 3000, 'error');
    }
}

/**
 * 사용자 상태 텍스트 반환
 * @param {string} status - 사용자 상태
 * @return {string} 상태 텍스트
 */
function getUserStatusText(status) {
    switch (status) {
        case 'online': return t('status_online');
        case 'away': return t('status_away');
        case 'dnd': return t('status_dnd');
        case 'offline': return t('status_offline');
        default: return t('status_online');
    }
}

/**
 * 사용자 상태 변경
 * @param {string} status - 변경할 상태
 */
function changeUserStatus(status) {
    try {
        appState.localUserStatus = status;
        
        // 로컬 스토리지에 저장
        LocalStorage.save('userStatus', status);
        
        // 상태 선택기 업데이트
        if (UI.statusSelector) {
            UI.statusSelector.value = status;
        }
        
        // UI 업데이트
        updateStatusIndicator(appState.localUserId, status);
        
        // 다른 사용자들에게 상태 업데이트 전송
        broadcastMessage({
            type: 'system',
            action: 'status_change',
            userId: appState.localUserId,
            status: status
        });
    } catch (error) {
        console.error('사용자 상태 변경 중 오류:', error);
    }
}

/**
 * 상태 표시기 업데이트
 * @param {string} userId - 사용자 ID
 * @param {string} status - 상태
 */
function updateStatusIndicator(userId, status) {
    try {
        // 사용자 목록에서 상태 표시
        const userItems = document.querySelectorAll(`.user-item[data-user-id="${userId}"]`);
        userItems.forEach(item => {
            // 기존 상태 클래스 제거
            item.classList.remove('status-online', 'status-away', 'status-dnd');
            
            // 새 상태 클래스 추가
            item.classList.add(`status-${status}`);
            
            // 상태 아이콘 업데이트
            const statusIcon = item.querySelector('.user-status-icon');
            if (statusIcon) {
                statusIcon.className = `user-status-icon status-${status}`;
                
                let statusTitle = t('status_online');
                if (status === 'away') statusTitle = t('status_away');
                if (status === 'dnd') statusTitle = t('status_dnd');
                
                statusIcon.title = statusTitle;
            }
        });
    } catch (error) {
        console.error('상태 표시기 업데이트 중 오류:', error);
    }
}

/**
 * 테마 전환
 * @param {Event} e - 이벤트 객체
 */
function toggleTheme(e) {
    try {
        const isLightTheme = e.target.checked;
        
        if (isLightTheme) {
            document.body.classList.add('light-theme');
        } else {
            document.body.classList.remove('light-theme');
        }
        
        // 설정 저장
        LocalStorage.save('darkTheme', !isLightTheme);
    } catch (error) {
        console.error('테마 전환 중 오류:', error);
    }
}

/**
 * 타이핑 상태 전송
 * @param {boolean} isTyping - 타이핑 중인지 여부
 */
function sendTypingStatus(isTyping) {
    try {
        // 타이머가 있으면 제거
        if (appState.typing.timeout) {
            clearTimeout(appState.typing.timeout);
            appState.typing.timeout = null;
        }
        
        // 타이핑 상태가 변경되지 않았으면 무시
        if (appState.typing.isTyping === isTyping) return;
        
        appState.typing.isTyping = isTyping;
        
        // 타이핑 상태 메시지 전송
        broadcastMessage({
            type: 'system',
            action: 'typing',
            userId: appState.localUserId,
            userName: appState.localUserName,
            isTyping: isTyping,
            channel: appState.currentChannel
        });
        
        // 일정 시간 후 타이핑 상태 해제 (5초)
        if (isTyping) {
            appState.typing.timeout = setTimeout(() => {
                sendTypingStatus(false);
            }, 5000);
        }
    } catch (error) {
        console.error('타이핑 상태 전송 중 오류:', error);
    }
}

/**
 * 타이핑 인디케이터 업데이트
 */
function updateTypingIndicator() {
    try {
        // typingIndicator 요소가 없으면 생성
        if (!UI.typingIndicator) {
            UI.typingIndicator = document.createElement('div');
            UI.typingIndicator.className = 'typing-indicator hidden';
            if (UI.chatMessages && UI.chatMessages.parentNode) {
                UI.chatMessages.parentNode.insertBefore(UI.typingIndicator, UI.chatMessages.nextSibling);
            }
        }
        
        // 현재 채널에서 타이핑 중인 사용자 필터링
        const typingUsers = Object.entries(appState.typing.users)
            .filter(([userId, info]) => 
                userId !== appState.localUserId && 
                info.isTyping && 
                info.channel === appState.currentChannel
            )
            .map(([userId, info]) => info.userName);
        
        // 타이핑 중인 사용자가 없으면 숨김
        if (typingUsers.length === 0) {
            UI.typingIndicator.classList.add('hidden');
            return;
        }
        
        // 타이핑 메시지 생성
        let typingMessage = '';
        if (typingUsers.length === 1) {
            typingMessage = t('typing_single', { user: typingUsers[0] });
        } else if (typingUsers.length === 2) {
            typingMessage = t('typing_double', { user1: typingUsers[0], user2: typingUsers[1] });
        } else {
            typingMessage = t('typing_multiple', { count: typingUsers.length });
        }
        
        // UI 업데이트
        UI.typingIndicator.textContent = typingMessage;
        UI.typingIndicator.classList.remove('hidden');
    } catch (error) {
        console.error('타이핑 인디케이터 업데이트 중 오류:', error);
    }
}

/**
 * 프로필 모달 표시
 */
function showProfileModal() {
    try {
        const profileModal = document.getElementById('profileModal');
        if (!profileModal) return;
        
        // 현재 값으로 입력 필드 설정
        const profileNameInput = document.getElementById('profileNameInput');
        if (profileNameInput) {
            profileNameInput.value = appState.localUserName;
        }
        
        // 현재 아바타 표시
        const currentAvatar = document.getElementById('currentAvatar');
        if (currentAvatar) {
            updateAvatarElement(currentAvatar, appState.localUserAvatar, appState.localUserName);
        }
        
        // 알림 설정 표시
        const notificationToggle = document.getElementById('notificationToggle');
        if (notificationToggle) {
            notificationToggle.checked = appState.notifications.desktop;
        }
        
        // 소리 알림 설정 표시
        const soundToggle = document.getElementById('soundToggle');
        if (soundToggle) {
            soundToggle.checked = appState.notifications.sound;
        }
        
        // 상태 선택기 표시
        const statusSelector = document.getElementById('statusSelector');
        if (statusSelector) {
            statusSelector.value = appState.localUserStatus;
        }
        
        // 언어 선택기 표시
        const languageSelector = document.getElementById('languageSelector');
        if (languageSelector) {
            languageSelector.value = appState.language;
        }
        
        // 보이스 설정 표시
        const noiseSuppressionToggle = document.getElementById('noiseSuppressionToggle');
        if (noiseSuppressionToggle) {
            noiseSuppressionToggle.checked = appState.noiseSuppression;
        }
        
        const echoCancellationToggle = document.getElementById('echoCancellationToggle');
        if (echoCancellationToggle) {
            echoCancellationToggle.checked = appState.echoCancellation;
        }
        
        // 테마 설정 표시
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.checked = document.body.classList.contains('light-theme');
        }
        
        // 알림 권한 UI 업데이트
        updateNotificationUI();
        
        // 모달 표시
        profileModal.classList.remove('hidden');
    } catch (error) {
        console.error('프로필 모달 표시 중 오류:', error);
        showToast(t('profile_load_error'), 3000, 'error');
    }
}

/**
 * 아바타 변경 처리
 * @param {Event} e - 이벤트 객체
 */
function handleAvatarChange(e) {
    try {
        const file = e.target.files[0];
        if (!file) return;
        
        // 파일 유형 검사
        if (!file.type.startsWith('image/')) {
            showToast(t('image_file_only'));
            return;
        }
        
        // 파일 크기 제한 (1MB)
        if (file.size > 1024 * 1024) {
            showToast(t('image_size_limit'));
            return;
        }
        
        // 이미지 미리보기 및 저장
        const reader = new FileReader();
        reader.onload = function(e) {
            const imageData = e.target.result;
            
            // 미리보기 업데이트
            const currentAvatar = document.getElementById('currentAvatar');
            if (currentAvatar) {
                currentAvatar.style.backgroundImage = `url(${imageData})`;
                currentAvatar.style.backgroundColor = 'transparent';
            }
            
            // 임시 저장 (저장 버튼 클릭 시 실제 저장됨)
            appState.tempAvatar = imageData;
        };
        
        reader.readAsDataURL(file);
    } catch (error) {
        console.error('아바타 변경 중 오류:', error);
        showToast(t('image_process_error'), 3000, 'error');
    }
}

/**
 * 프로필 저장
 */
function saveProfile() {
    try {
        const profileNameInput = document.getElementById('profileNameInput');
        const notificationToggle = document.getElementById('notificationToggle');
        const soundToggle = document.getElementById('soundToggle');
        const statusSelector = document.getElementById('statusSelector');
        const languageSelector = document.getElementById('languageSelector');
        const themeToggle = document.getElementById('themeToggle');
        
        // 사용자 이름 변경
        if (profileNameInput && profileNameInput.value.trim()) {
            const newName = profileNameInput.value.trim();
            if (newName !== appState.localUserName) {
                // 이름 변경
                appState.localUserName = newName;
                const userNameElement = document.getElementById('userName');
                if (userNameElement) userNameElement.textContent = newName;
                LocalStorage.save('userName', newName);
                
                // 변경된 이름 브로드캐스트
                broadcastMessage({
                    type: 'system',
                    action: 'user_info',
                    userId: appState.localUserId,
                    userName: newName,
                    userAvatar: appState.localUserAvatar,
                    userStatus: appState.localUserStatus,
                    isHost: appState.isHost,
                    isAdmin: appState.isAdmin
                });
            }
        }
        
        // 아바타 변경
        if (appState.tempAvatar) {
            appState.localUserAvatar = appState.tempAvatar;
            updateAvatarDisplay(appState.localUserAvatar);
            LocalStorage.save('userAvatar', appState.localUserAvatar);
            
            // 변경된 아바타 브로드캐스트
            broadcastMessage({
                type: 'system',
                action: 'user_info',
                userId: appState.localUserId,
                userName: appState.localUserName,
                userAvatar: appState.localUserAvatar,
                userStatus: appState.localUserStatus,
                isHost: appState.isHost,
                isAdmin: appState.isAdmin
            });
            
            // 임시 아바타 삭제
            delete appState.tempAvatar;
        }
        
        // 알림 설정 저장
        if (notificationToggle) {
            appState.notifications.desktop = notificationToggle.checked;
        }
        
        // 소리 알림 설정 저장
        if (soundToggle) {
            appState.notifications.sound = soundToggle.checked;
        }
        
        // 사용자 상태 변경
        if (statusSelector && statusSelector.value !== appState.localUserStatus) {
            changeUserStatus(statusSelector.value);
        }
        
        // 언어 변경
        if (languageSelector && languageSelector.value !== appState.language) {
            changeLanguage(languageSelector.value);
        }
        
        // 테마 변경
        if (themeToggle) {
            const isLightTheme = themeToggle.checked;
            if (isLightTheme !== document.body.classList.contains('light-theme')) {
                toggleTheme({ target: { checked: isLightTheme } });
            }
        }
        
        // 알림 설정 저장
        saveNotificationSettings();
        
        // 모달 닫기
        safeGetElement('profileModal', (modal) => modal.classList.add('hidden'));
        
        showToast(t('profile_saved'));
    } catch (error) {
        console.error('프로필 저장 중 오류:', error);
        showToast(t('profile_save_error'), 3000, 'error');
    }
}

/**
 * 사용자 이름 저장
 * @param {string} userName - 저장할 사용자 이름
 */
function saveUserName(userName) {
    try {
        if (!userName || typeof userName !== 'string') {
            console.warn('유효하지 않은 사용자 이름:', userName);
            return;
        }
        
        appState.localUserName = userName;
        if (UI.userName) UI.userName.textContent = userName;
        
        // 로컬 스토리지에 저장
        LocalStorage.save('userName', userName);
        
        // 다른 사용자들에게 이름 업데이트 전송
        if (Object.keys(appState.connections).length > 0) {
            broadcastMessage({
                type: 'system',
                action: 'user_info',
                userId: appState.localUserId,
                userName: userName,
                userAvatar: appState.localUserAvatar,
                userStatus: appState.localUserStatus,
                isHost: appState.isHost,
                isAdmin: appState.isAdmin
            });
        }
    } catch (error) {
        console.error('사용자 이름 저장 중 오류:', error);
    }
}

/**
 * 간단한 방 ID 생성 (4자리)
 * @return {string} 생성된 방 ID
 */
function generateSimpleRoomId() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 4; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

/**
 * 새 방 생성
 */
function createRoom() {
    try {
        // 기존 연결 정리
        cleanupConnections();
        
        // 새 방 ID 생성
        const roomId = generateSimpleRoomId();
        appState.roomId = roomId;
        appState.isHost = true;
        appState.isAdmin = true;
        
        // 연결 과정 시작
        showConnectionModal();
        updateConnectionStep(1, 'active');
        
        // PeerJS 인스턴스 생성 (개선된 ICE 서버 구성)
        appState.peer = new Peer(roomId, {
            debug: 1, // 디버그 레벨 낮춤
            config: {
                'iceServers': ICE_SERVERS,
                'sdpSemantics': 'unified-plan', // 최신 WebRTC 표준 사용
                'iceCandidatePoolSize': 10 // ICE 후보 풀 크기 증가
            }
        });
        
        // PeerJS 이벤트 리스너 설정
        setupPeerEvents();
        
        // UI 업데이트
        if (UI.roomName) UI.roomName.textContent = `채팅방 #${roomId}`;
        
        // URL 업데이트
        updateUrlWithRoomId(roomId);
        
        // 네트워크 품질 모니터링 시작
        startNetworkMonitoring();
    } catch (error) {
        console.error('방 생성 중 오류:', error);
        handleConnectionError(t('room_creation_error', { error: error.message }));
    }
}

/**
 * 방 참여
 * @param {string} roomId - 참여할 방 ID
 */
function joinRoom(roomId) {
    try {
        // 초대 코드 검증 (4자리 영숫자만 허용)
        if (!/^[a-z0-9]{4}$/i.test(roomId)) {
            handleConnectionError(t('invalid_invite_code'));
            return;
        }
        
        // 기존 연결 정리
        cleanupConnections();
        
        // 방 정보 설정
        appState.roomId = roomId;
        appState.isHost = false;
        
        // 연결 과정 시작
        showConnectionModal();
        updateConnectionStep(1, 'active');
        
        // 랜덤 피어 ID 생성
        const peerId = 'user-' + Math.random().toString(36).substr(2, 9);
        appState.localUserId = peerId;
        
        // PeerJS 인스턴스 생성 (개선된 ICE 서버 구성)
        appState.peer = new Peer(peerId, {
            debug: 1, // 디버그 레벨 낮춤
            config: {
                'iceServers': ICE_SERVERS,
                'sdpSemantics': 'unified-plan', // 최신 WebRTC 표준 사용
                'iceCandidatePoolSize': 10 // ICE 후보 풀 크기 증가
            }
        });
        
        // PeerJS 이벤트 리스너 설정
        setupPeerEvents();
        
        // 호스트에 연결 시도
        appState.peer.on('open', (id) => {
            console.log('PeerJS ID 할당됨:', id);
            updateConnectionStep(1, 'complete');
            updateConnectionStep(2, 'active');
            
            // 호스트에 연결
            connectToHost(roomId);
        });
        
        // UI 업데이트
        if (UI.roomName) UI.roomName.textContent = `채팅방 #${roomId}`;
        
        // URL 업데이트
        updateUrlWithRoomId(roomId);
        
        // 네트워크 품질 모니터링 시작
        startNetworkMonitoring();
    } catch (error) {
        console.error('방 참여 중 오류:', error);
        handleConnectionError(t('room_join_error', { error: error.message }));
    }
}

/**
 * 호스트에 연결
 * @param {string} hostId - 호스트 ID
 */
function connectToHost(hostId) {
    console.log('호스트에 연결 시도:', hostId);
    
    // 피어ID가 존재하는지 확인
    if (!appState.localUserId) {
        console.error('로컬 피어 ID가 설정되지 않았습니다.');
        handleConnectionError(t('connection_init_error'));
        return;
    }
    
    try {
        const conn = appState.peer.connect(hostId, {
            reliable: true,
            serialization: 'json' // JSON 직렬화 사용
        });
        
        // 연결 시간 초과 처리
        const connectionTimeout = setTimeout(() => {
            if (!appState.connections[hostId]) {
                console.error('호스트 연결 시간 초과');
                handleConnectionError(t('host_connection_timeout'));
            }
        }, 20000); // 20초 타임아웃
        
        conn.on('open', () => {
            console.log('호스트에 연결됨');
            clearTimeout(connectionTimeout); // 타임아웃 취소
            
            updateConnectionStep(2, 'complete');
            updateConnectionStep(3, 'active');
            
            // 연결 정보 저장
            appState.connections[hostId] = conn;
            
            // 자신의 정보 전송
            sendData(conn, {
                type: 'system',
                action: 'user_info',
                userId: appState.localUserId,
                userName: appState.localUserName,
                userAvatar: appState.localUserAvatar,
                userStatus: appState.localUserStatus
            });
            
            // 연결 성공 처리
            onConnectionSuccess();
            
            // 연결 상태 업데이트
            updateConnectionStatusFromPeers();
        });
        
        conn.on('data', (data) => {
            handleReceivedMessage(data, hostId);
        });
        
        conn.on('close', () => {
            console.log('호스트 연결 종료');
            handlePeerDisconnect(hostId);
        });
        
        conn.on('error', (err) => {
            console.error('호스트 연결 오류:', err);
            handleConnectionError(t('host_connection_error', { error: err.message }));
        });
    } catch (err) {
        console.error('호스트 연결 시도 중 예외 발생:', err);
        handleConnectionError(t('connection_attempt_error', { error: err.message }));
    }
}

/**
 * 네트워크 모니터링 시작
 */
function startNetworkMonitoring() {
    try {
        // 주기적으로 연결 상태 모니터링
        const monitoringInterval = setInterval(() => {
            // 연결이 끊어졌는지 확인
            if (!appState.connectionEstablished) {
                clearInterval(monitoringInterval);
                return;
            }
            
            // 피어 연결 수 확인
            const connectedPeers = Object.keys(appState.connections).length;
            
            // 모든 연결이 끊어진 경우 (호스트 제외)
            if (connectedPeers === 0 && !appState.isHost) {
                updateConnectionStatus(t('connection_lost'), 'disconnected');
                
                // 재연결 시도
                if (appState.peer && appState.peer.disconnected) {
                    console.log('연결이 끊겼습니다. 재연결 시도...');
                    appState.peer.reconnect();
                }
            }
            
            // 각 피어 연결 상태 확인
            Object.entries(appState.connections).forEach(([peerId, conn]) => {
                if (conn.peerConnection) {
                    try {
                        conn.peerConnection.getStats(null).then(stats => {
                            stats.forEach(report => {
                                if (report.type === 'transport') {
                                    // 연결 상태 저장
                                    appState.peerConnectionStats[peerId] = {
                                        timestamp: Date.now(),
                                        bytesReceived: report.bytesReceived,
                                        bytesSent: report.bytesSent
                                    };
                                }
                            });
                        }).catch(err => {
                            console.warn('연결 상태 조회 실패:', err);
                        });
                    } catch (e) {
                        console.warn('연결 상태 모니터링 중 오류:', e);
                    }
                }
            });
        }, 5000); // 5초마다 확인
    } catch (error) {
        console.error('네트워크 모니터링 시작 중 오류:', error);
    }
}

/**
 * PeerJS 이벤트 리스너 설정
 */
function setupPeerEvents() {
    try {
        if (!appState.peer) {
            throw new Error('PeerJS 인스턴스가 없습니다.');
        }
        
        appState.peer.on('open', (id) => {
            console.log('PeerJS ID 할당됨:', id);
            appState.localUserId = id;
            
            if (appState.isHost) {
                updateConnectionStep(1, 'complete');
                updateConnectionStep(2, 'complete');
                updateConnectionStep(3, 'complete');
                
                // 호스트로서 연결 성공
                onConnectionSuccess();
                
                // 시스템 메시지 추가
                addSystemMessage(t('room_created', { code: appState.roomId }));
                addSystemMessage(t('invite_instruction'));
            }
        });
        
        appState.peer.on('connection', (conn) => {
            console.log('새 피어 연결 요청:', conn.peer);
            
            conn.on('open', () => {
                console.log('피어에 연결됨:', conn.peer);
                
                // 연결 정보 저장
                appState.connections[conn.peer] = conn;
                
                // 데이터 리스너 설정
                conn.on('data', (data) => {
                    handleReceivedMessage(data, conn.peer);
                });
                
                // 자신의 정보 전송
                sendData(conn, {
                    type: 'system',
                    action: 'user_info',
                    userId: appState.localUserId,
                    userName: appState.localUserName,
                    userAvatar: appState.localUserAvatar,
                    userStatus: appState.localUserStatus,
                    isHost: appState.isHost,
                    isAdmin: appState.isAdmin
                });
                
                // 현재 접속 중인 다른 사용자 정보 전송 (호스트만)
                if (appState.isHost) {
                    // 차단된 사용자인지 확인
                    if (appState.bannedUsers[conn.peer]) {
                        console.log('차단된 사용자 연결 시도:', conn.peer);
                        // 차단 메시지 전송
                        sendData(conn, {
                            type: 'admin',
                            action: 'ban',
                            targetId: conn.peer,
                            fromId: appState.localUserId,
                            fromName: appState.localUserName,
                            message: t('banned_from_room')
                        });
                        
                        // 연결 종료
                        setTimeout(() => {
                            conn.close();
                        }, 1000);
                        return;
                    }
                    
                    // 다른 모든 사용자 정보 전송
                    Object.entries(appState.users).forEach(([userId, user]) => {
                        if (userId !== appState.localUserId && userId !== conn.peer) {
                            sendData(conn, {
                                type: 'system',
                                action: 'user_info',
                                userId: userId,
                                userName: user.name,
                                userAvatar: user.avatar,
                                userStatus: user.status || 'online',
                                isHost: user.role === 'host',
                                isAdmin: user.role === 'admin'
                            });
                        }
                    });
                    
                    // 삭제된 메시지 목록 동기화
                    if (Object.keys(appState.deletedMessages).length > 0) {
                        sendData(conn, {
                            type: 'system',
                            action: 'sync_deleted_messages',
                            deletedMessages: appState.deletedMessages
                        });
                    }
                    
                    // 채널 목록 동기화
                    Object.entries(appState.channels).forEach(([channelId, channel]) => {
                        if (channelId !== 'general') {
                            sendData(conn, {
                                type: 'channel',
                                action: 'create',
                                channelId: channelId,
                                channelName: channel.name,
                                channelType: channel.type || 'text'
                            });
                        }
                    });
                    
                    // 음성 채널 목록 동기화
                    Object.entries(appState.voiceChannels).forEach(([channelId, channel]) => {
                        if (channelId !== 'voice-general') {
                            sendData(conn, {
                                type: 'channel',
                                action: 'create_voice',
                                channelId: channelId,
                                channelName: channel.name
                            });
                        }
                    });
                    
                    // 새 유저 연결 정보를 다른 모든 유저에게 알림
                    Object.entries(appState.connections).forEach(([peerId, peerConn]) => {
                        if (peerId !== conn.peer) {
                            sendData(peerConn, {
                                type: 'system',
                                action: 'new_peer_connected',
                                userId: conn.peer
                            });
                        }
                    });
                }
                
                // 자신이 호스트임을 알림
                if (appState.isHost) {
                    sendData(conn, {
                        type: 'system',
                        action: 'host_info',
                        userId: appState.localUserId,
                        isHost: true
                    });
                }
                
                // 현재 음성 채널 상태 전송
                Object.entries(appState.voiceChannels).forEach(([channelId, channel]) => {
                    if (channel.users && channel.users.length > 0) {
                        sendData(conn, {
                            type: 'voice',
                            action: 'channel_status',
                            channelId: channelId,
                            users: channel.users
                        });
                    }
                });
            });
            
            conn.on('close', () => {
                console.log('피어 연결 종료:', conn.peer);
                handlePeerDisconnect(conn.peer);
            });
            
            conn.on('error', (err) => {
                console.error('피어 연결 오류:', err);
            });
        });
        
        // 음성 통화 수신 이벤트
        appState.peer.on('call', (mediaConnection) => {
            console.log('음성 통화 수신:', mediaConnection.peer);
            
            // 현재 보이스 채널에 참여 중이 아니면 거부
            if (!appState.currentVoiceChannel || !appState.localStream) {
                console.log('음성 통화 수신 거부: 음성 채널 비활성화');
                mediaConnection.close();
                return;
            }
            
            // 상대방이 참여한 채널이 다르면 거부
            const peerChannelId = Object.entries(appState.voiceChannels).find(([id, channel]) => 
                channel.users && channel.users.includes(mediaConnection.peer)
            )?.[0];
            
            if (peerChannelId !== appState.currentVoiceChannel) {
                console.log('음성 통화 수신 거부: 다른 채널');
                mediaConnection.close();
                return;
            }
            
            // 로컬 스트림으로 응답
            mediaConnection.answer(appState.localStream);
            
            // 연결 정보 저장
            appState.voiceConnections[mediaConnection.peer] = {
                mediaConnection: mediaConnection,
                remoteStream: null
            };
            
            // 상대방 스트림 처리
            mediaConnection.on('stream', (remoteStream) => {
                console.log('음성 스트림 수신:', mediaConnection.peer);
                appState.voiceConnections[mediaConnection.peer].remoteStream = remoteStream;
                
                // 헤드셋 상태에 따라 초기 음소거
                if (appState.isDeafened) {
                    remoteStream.getAudioTracks().forEach(track => {
                        track.enabled = false;
                    });
                }
                
                // 오디오 요소 생성 및 재생
                const audioEl = new Audio();
                audioEl.srcObject = remoteStream;
                audioEl.autoplay = true;
                
                // 연결 정보에 오디오 요소 저장
                appState.voiceConnections[mediaConnection.peer].audioElement = audioEl;
                
                // 음성 사용자 UI 업데이트
                updateVoiceUsers();
            });
            
            // 연결 종료 이벤트
            mediaConnection.on('close', () => {
                console.log('음성 연결 종료:', mediaConnection.peer);
                
                // 연결 정보에서 제거
                delete appState.voiceConnections[mediaConnection.peer];
                
                // 음성 사용자 UI 업데이트
                updateVoiceUsers();
            });
            
            mediaConnection.on('error', (err) => {
                console.error('음성 연결 오류:', mediaConnection.peer, err);
            });
        });
        
        appState.peer.on('error', (err) => {
            console.error('PeerJS 오류:', err);
            
            // 특정 오류 처리
            if (err.type === 'peer-unavailable') {
                handleConnectionError(t('peer_unavailable'));
            } else if (err.type === 'network' || err.type === 'server-error') {
                handleConnectionError(t('network_connection_error'));
            } else if (err.type === 'socket-error') {
                handleConnectionError(t('socket_connection_error'));
            } else {
                handleConnectionError(t('connection_error', { error: err.message || err.type }));
            }
        });
        
        appState.peer.on('disconnected', () => {
            console.log('PeerJS 서버와 연결 끊김');
            updateConnectionStatus(t('server_disconnected'), 'disconnected');
            
            // 자동 재연결 시도
            setTimeout(() => {
                if (appState.peer && appState.connectionRetryCount < MAX_RETRY_COUNT) {
                    appState.connectionRetryCount++;
                    console.log(`재연결 시도 ${appState.connectionRetryCount}/${MAX_RETRY_COUNT}`);
                    updateConnectionStatus(t('reconnecting', { count: appState.connectionRetryCount, max: MAX_RETRY_COUNT }), 'waiting');
                    appState.peer.reconnect();
                } else {
                    handleConnectionError(t('server_unreachable'));
                }
            }, 1000);
        });
        
        appState.peer.on('close', () => {
            console.log('PeerJS 연결 닫힘');
            updateConnectionStatus(t('connection_closed'), 'disconnected');
            appState.connectionEstablished = false;
        });
    } catch (error) {
        console.error('PeerJS 이벤트 리스너 설정 중 오류:', error);
        handleConnectionError(t('peerjs_event_error', { error: error.message }));
    }
}

/**
 * 연결 모달 표시
 */
function showConnectionModal() {
    try {
        if (UI.connectionModal && UI.entryModal && UI.connectionError) {
            UI.connectionModal.classList.remove('hidden');
            UI.entryModal.classList.add('hidden');
            UI.connectionError.classList.add('hidden');
            
            // 모든 단계 초기화
            [UI.connectionStep1, UI.connectionStep2, UI.connectionStep3].forEach(step => {
                if (step) step.classList.remove('active', 'complete', 'error');
            });
            
            // 로더 초기화
            document.querySelectorAll('.loader').forEach(loader => {
                loader.style.width = '0%';
            });
            
            // 재시도 횟수 초기화
            appState.connectionRetryCount = 0;
        }
    } catch (error) {
        console.error('연결 모달 표시 중 오류:', error);
    }
}

/**
 * 연결 단계 업데이트
 * @param {number} stepNumber - 업데이트할 단계 번호
 * @param {string} status - 상태 (active, complete, error)
 */
function updateConnectionStep(stepNumber, status) {
    try {
        const stepElement = document.getElementById(`step${stepNumber}`);
        if (!stepElement) return;
        
        // 기존 상태 제거
        stepElement.classList.remove('active', 'complete', 'error');
        
        // 새 상태 추가
        if (status) {
            stepElement.classList.add(status);
        }
        
        // 로더 업데이트
        const loader = stepElement.querySelector('.loader');
        if (loader) {
            if (status === 'active') {
                loader.style.width = '100%';
            } else if (status === 'complete') {
                loader.style.width = '100%';
            } else if (status === 'error') {
                loader.style.width = '100%';
            } else {
                loader.style.width = '0%';
            }
        }
    } catch (error) {
        console.error('연결 단계 업데이트 중 오류:', error);
    }
}

/**
 * 연결 오류 처리
 * @param {string} message - 오류 메시지
 */
function handleConnectionError(message) {
    console.error('연결 오류:', message);
    
    try {
        // 현재 활성화된 단계를 오류 상태로 변경
        for (let i = 1; i <= 3; i++) {
            const step = document.getElementById(`step${i}`);
            if (step && step.classList.contains('active')) {
                step.classList.remove('active');
                step.classList.add('error');
            }
        }
        
        // 오류 메시지 표시
        if (UI.connectionError) {
            UI.connectionError.classList.remove('hidden');
            const errorMessageElement = document.querySelector('.error-message');
            if (errorMessageElement) {
                errorMessageElement.textContent = message;
            }
        }
        
        // 연결 상태 업데이트
        updateConnectionStatus(t('connection_failed'), 'disconnected');
        
        // 오류 알림 표시
        showToast(message, 5000, 'error');
        
        // 오류 효과음 재생
        playNotificationSound('error');
        
        // 연결 정리
        if (appState.peer) {
            appState.peer.destroy();
            appState.peer = null;
        }
    } catch (error) {
        console.error('연결 오류 처리 중 추가 오류:', error);
    }
}

/**
 * 연결 성공 처리
 */
function onConnectionSuccess() {
    try {
        updateConnectionStep(3, 'complete');
        
        // 사용자 정보 초기화
        if (!appState.users[appState.localUserId]) {
            appState.users[appState.localUserId] = {
                name: appState.localUserName,
                avatar: appState.localUserAvatar,
                status: appState.localUserStatus,
                role: appState.isHost ? 'host' : (appState.isAdmin ? 'admin' : 'user')
            };
        }
        
        // 연결 설정 완료
        appState.connectionEstablished = true;
        
        // 모달 닫기 (지연 적용)
        setTimeout(() => {
            if (UI.connectionModal) {
                UI.connectionModal.classList.add('hidden');
            }
            updateConnectionStatus(appState.isHost ? t('waiting_users', { count: 0 }) : t('connected'), 
                                  appState.isHost ? 'waiting' : 'connected');
            updateUsersList();
        }, 1000);
        
        // 호스트가 아닐 경우만 환영 메시지
        if (!appState.isHost) {
            addSystemMessage(t('joined_room', { room: appState.roomId }));
        }
        
        // 성공 알림음 재생
        playNotificationSound('connect');
    } catch (error) {
        console.error('연결 성공 처리 중 오류:', error);
    }
}

/**
 * 연결 상태 업데이트
 * @param {string} text - 상태 텍스트
 * @param {string} status - 상태 클래스 (connected, disconnected, waiting)
 */
function updateConnectionStatus(text, status) {
    try {
        if (!UI.connectionStatus) return;
        
        UI.connectionStatus.textContent = text;
        
        // 클래스 초기화
        UI.connectionStatus.classList.remove('connected', 'disconnected', 'waiting');
        
        // 상태에 따른 클래스 추가
        if (status) {
            UI.connectionStatus.classList.add(status);
        }
    } catch (error) {
        console.error('연결 상태 업데이트 중 오류:', error);
    }
}

/**
 * 알림음 재생
 * @param {string} type - 알림 유형 (message, connect, error, voice_join, voice_leave)
 */
function playNotificationSound(type) {
    // 알림 설정 확인
    if (!appState.notifications.sound) return;
    
    console.log('알림 소리 재생:', type);
    
    try {
        // 사운드 파일 경로 결정
        let soundFile;
        switch (type) {
            case 'message':
                soundFile = SOUNDS.MESSAGE;
                break;
            case 'connect':
                soundFile = SOUNDS.CONNECT;
                break;
            case 'error':
                soundFile = SOUNDS.ERROR;
                break;
            case 'voice_join':
                soundFile = SOUNDS.VOICE_JOIN;
                break;
            case 'voice_leave':
                soundFile = SOUNDS.VOICE_LEAVE;
                break;
            case 'disconnect':
                soundFile = SOUNDS.DISCONNECT;
                break;
            default:
                soundFile = SOUNDS.MESSAGE;
        }
        
        // 오디오 객체 생성 및 재생
        const audio = new Audio(AUDIO_PATH + soundFile);
        audio.volume = 0.5;
        
        // 안전하게 재생 시도
        let playPromise = audio.play();
        
        if (playPromise !== undefined) {
            playPromise.then(_ => {
                // 재생 성공
            }).catch(e => {
                console.warn('알림 소리 재생 실패:', e);
                
                // 오디오 API 사용 불가능한 경우 대체 사운드 재생
                try {
                    // Web Audio API로 간단한 비프음 재생
                    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                    const oscillator = audioCtx.createOscillator();
                    const gainNode = audioCtx.createGain();
                    
                    oscillator.connect(gainNode);
                    gainNode.connect(audioCtx.destination);
                    
                    // 알림 유형에 따른 소리 조정
                    if (type === 'error') {
                        oscillator.type = 'sawtooth';
                        oscillator.frequency.value = 440;
                        gainNode.gain.value = 0.3;
                        oscillator.start();
                        setTimeout(() => oscillator.stop(), 300);
                    } else if (type === 'connect') {
                        oscillator.type = 'sine';
                        oscillator.frequency.value = 587.33; // D5
                        gainNode.gain.value = 0.2;
                        oscillator.start();
                        setTimeout(() => {
                            oscillator.frequency.value = 659.25; // E5
                            setTimeout(() => oscillator.stop(), 200);
                        }, 200);
                    } else {
                        oscillator.type = 'sine';
                        oscillator.frequency.value = 523.25; // C5
                        gainNode.gain.value = 0.2;
                        oscillator.start();
                        setTimeout(() => oscillator.stop(), 200);
                    }
                } catch (e2) {
                    console.warn('Web Audio API 대체 재생 실패:', e2);
                }
            });
        }
    } catch (error) {
        console.error('알림 소리 재생 중 오류:', error);
    }
}

/**
 * 수신된 메시지 처리
 * @param {Object} message - 수신된 메시지 객체
 * @param {string} fromPeerId - 발신자 피어 ID
 */
function handleReceivedMessage(message, fromPeerId) {
    try {
        console.log('메시지 수신:', message);
        
        // 핑/퐁 메시지 특별 처리
        if (message.type === 'ping') {
            handlePingMessage(message, fromPeerId);
            return;
        }
        
        if (message.type === 'pong') {
            handlePongMessage(message, fromPeerId);
            return;
        }
        
        // 호스트인 경우, 다른 모든 피어에게 메시지 중계
        if (appState.isHost && message.type !== 'system') {
            // 메시지 중계: 발신자를 제외한 모든 피어에게 전달
            relayMessageToAllPeers(message, fromPeerId);
        }
        if (message.type === 'ping') {
            // 핑에 대한 응답 전송
            if (appState.connections[fromPeerId]) {
                sendData(appState.connections[fromPeerId], { 
                    type: 'pong', 
                    timestamp: message.timestamp,
                    responseTime: Date.now() 
                });
            }
             // 다른 처리 없이 종료
        }
        switch (message.type) {
            case 'chat':
                // 삭제된 메시지인지 확인
                if (message.messageId && appState.deletedMessages[message.messageId]) {
                    console.log('삭제된 메시지 무시:', message.messageId);
                    return;
                }
                
                // 채팅 메시지 표시
                addChatMessage(message.userName, message.content, message.timestamp, message.messageId, message.userId);
                
                // 메시지 히스토리에 추가
                if (message.channel) {
                    // 특정 채널 메시지
                    if (appState.channels[message.channel]) {
                        appState.channels[message.channel].messages.push(message);
                    }
                } else {
                    // 기본 채널 메시지
                    appState.messageHistory.push(message);
                }
                
                // 데스크톱 알림 표시 (다른 사용자의 메시지만)
                if (message.userName !== appState.localUserName) {
                    // 현재 채널이 아닌 경우 알림에 채널명 추가
                    const notificationTitle = message.channel !== appState.currentChannel ? 
                        `${message.userName} (${appState.channels[message.channel]?.name || message.channel})` :
                        message.userName;
                    
                    showDesktopNotification(notificationTitle, message.content);
                    
                    // 탭 활성화 상태가 아니면 제목에 알림 표시
                    if (document.visibilityState !== 'visible') {
                        document.title = `${t('new_message')} cchat - ${t('room', { room: appState.roomId || '' })}`;
                    }
                    
                    // 알림음 재생
                    playNotificationSound('message');
                }
                break;
                
            case 'system':
                // 시스템 메시지 처리
                handleSystemMessage(message, fromPeerId);
                break;
                
            case 'file':
                // 파일 메시지 처리
                handleFileMessage(message, fromPeerId);
                
                // 메시지 히스토리에 추가 (파일 정보 메시지만)
                if (message.action === 'file_info') {
                    // 메시지 ID 추가
                    if (!message.messageId) {
                        message.messageId = generateMessageId();
                    }
                    
                    // 채널 정보가 있으면 채널 메시지로 추가
                    if (message.channel && appState.channels[message.channel]) {
                        appState.channels[message.channel].messages.push(message);
                    } else {
                        // 일반 메시지
                        appState.messageHistory.push(message);
                    }
                    
                    // 파일 알림 (다른 사용자의 파일만)
                    if (message.userName !== appState.localUserName) {
                        showDesktopNotification(message.userName, t('file_shared', { name: message.fileName }));
                        
                        // 알림음 재생
                        playNotificationSound('message');
                    }
                }
                break;
                
            case 'history':
                // 메시지 히스토리 수신
                handleHistoryMessage(message);
                break;
                
            case 'channel':
                // 채널 관련 메시지 처리
                handleChannelMessage(message);
                break;
                
            case 'admin':
                // 관리자 명령 처리
                handleAdminMessage(message);
                break;
                
            case 'delete':
                // 메시지 삭제 처리
                handleDeleteMessage(message);
                break;
                
            case 'voice':
                // 음성 채널 관련 메시지 처리
                handleVoiceMessage(message, fromPeerId);
                break;
                
            default:
                console.warn('알 수 없는 메시지 유형:', message.type);
        }
    } catch (error) {
        console.error('메시지 처리 중 오류:', error);
    }
}

/**
 * 음성 메시지 처리
 * @param {Object} message - 음성 메시지
 * @param {string} fromPeerId - 발신자 피어 ID
 */
function handleVoiceMessage(message, fromPeerId) {
    try {
        console.log('음성 메시지 수신:', message);
        
        switch (message.action) {
            case 'join_channel':
                // 사용자가 음성 채널에 참여
                if (message.channelId && appState.voiceChannels[message.channelId]) {
                    // 채널에 사용자 추가
                    if (!appState.voiceChannels[message.channelId].users.includes(message.userId)) {
                        appState.voiceChannels[message.channelId].users.push(message.userId);
                    }
                    
                    // 음성 채널 목록 업데이트
                    updateVoiceChannelsList();
                    
                    // 자신이 같은 채널에 있으면 연결 시도
                    if (appState.currentVoiceChannel === message.channelId) {
                        setTimeout(() => {
                            createVoiceConnection(message.userId);
                        }, 500);
                    }
                    
                    // 시스템 메시지 표시
                    const userName = appState.users[message.userId]?.name || message.userName;
                    const channelName = appState.voiceChannels[message.channelId].name;
                    addSystemMessage(t('user_joined_voice', { user: userName, channel: channelName }));
                }
                break;
                
            case 'leave_channel':
                // 사용자가 음성 채널에서 나감
                if (message.channelId && appState.voiceChannels[message.channelId]) {
                    // 채널에서 사용자 제거
                    appState.voiceChannels[message.channelId].users = 
                        appState.voiceChannels[message.channelId].users.filter(id => id !== message.userId);
                    
                    // 음성 채널 목록 업데이트
                    updateVoiceChannelsList();
                    
                    // 음성 연결 종료
                    if (appState.voiceConnections[message.userId]) {
                        if (appState.voiceConnections[message.userId].mediaConnection) {
                            appState.voiceConnections[message.userId].mediaConnection.close();
                        }
                        delete appState.voiceConnections[message.userId];
                    }
                    
                    // 음성 사용자 UI 업데이트
                    updateVoiceUsers();
                    
                    // 시스템 메시지 표시
                    const userName = appState.users[message.userId]?.name || message.userId;
                    const channelName = appState.voiceChannels[message.channelId].name;
                    addSystemMessage(t('user_left_voice', { user: userName, channel: channelName }));
                }
                break;
                
            case 'mute_status':
                // 사용자의 음소거 상태 변경
                if (message.userId && appState.voiceConnections[message.userId]) {
                    appState.voiceConnections[message.userId].isMuted = message.isMuted;
                    
                    // 음성 사용자 UI 업데이트
                    updateVoiceUsers();
                }
                break;
                
            case 'deafen_status':
                // 사용자의 헤드셋 상태 변경
                if (message.userId && appState.voiceConnections[message.userId]) {
                    appState.voiceConnections[message.userId].isDeafened = message.isDeafened;
                    
                    // 음성 사용자 UI 업데이트
                    updateVoiceUsers();
                }
                break;
                
            case 'channel_status':
                // 채널 상태 업데이트 (사용자 목록)
                if (message.channelId && appState.voiceChannels[message.channelId] && message.users) {
                    appState.voiceChannels[message.channelId].users = message.users;
                    
                    // 음성 채널 목록 업데이트
                    updateVoiceChannelsList();
                }
                break;
                
            default:
                console.warn('알 수 없는 음성 메시지 액션:', message.action);
        }
    } catch (error) {
        console.error('음성 메시지 처리 중 오류:', error);
    }
}

/**
 * 메시지 삭제 처리
 * @param {Object} message - 삭제 메시지 객체
 */
function handleDeleteMessage(message) {
    try {
        console.log('메시지 삭제 요청:', message);
        
        if (!message.messageId) return;
        
        // 삭제된 메시지 ID 저장
        appState.deletedMessages[message.messageId] = true;
        
        // UI에서 메시지 삭제 또는 '삭제된 메시지'로 표시
        const messageElement = document.getElementById(`message-${message.messageId}`);
        if (messageElement) {
            // 관리자 삭제인 경우 완전히 제거, 아니면 '삭제된 메시지'로 표시
            if (message.byAdmin) {
                messageElement.remove();
            } else {
                const messageText = messageElement.querySelector('.message-text');
                if (messageText) {
                    messageText.innerHTML = `<em class="deleted-message">${t('deleted_message')}</em>`;
                }
                
                // 삭제 버튼 제거
                const deleteBtn = messageElement.querySelector('.message-delete-btn');
                if (deleteBtn) {
                    deleteBtn.remove();
                }
            }
        }
        
        // 메시지 히스토리에서도 삭제 처리
        markMessageAsDeleted(message.messageId, message.channel);
    } catch (error) {
        console.error('메시지 삭제 처리 중 오류:', error);
    }
}

/**
 * 히스토리에서 메시지 삭제 표시
 * @param {string} messageId - 메시지 ID
 * @param {string} channelId - 채널 ID
 */
function markMessageAsDeleted(messageId, channelId) {
    try {
        // 특정 채널 메시지인 경우
        if (channelId && appState.channels[channelId]) {
            const messages = appState.channels[channelId].messages;
            const messageIndex = messages.findIndex(msg => msg.messageId === messageId);
            
            if (messageIndex !== -1) {
                if (messages[messageIndex].type === 'chat') {
                    messages[messageIndex].deleted = true;
                    messages[messageIndex].content = t('deleted_message');
                }
            }
        } else {
            // 일반 메시지
            const messageIndex = appState.messageHistory.findIndex(msg => msg.messageId === messageId);
            
            if (messageIndex !== -1) {
                if (appState.messageHistory[messageIndex].type === 'chat') {
                    appState.messageHistory[messageIndex].deleted = true;
                    appState.messageHistory[messageIndex].content = t('deleted_message');
                }
            }
        }
    } catch (error) {
        console.error('메시지 삭제 표시 중 오류:', error);
    }
}

/**
 * 호스트가 메시지를 다른 모든 피어에게 중계
 * @param {Object} message - 중계할 메시지
 * @param {string} senderPeerId - 발신자 피어 ID
 */
function relayMessageToAllPeers(message, senderPeerId) {
    if (!appState.isHost) return; // 호스트만 중계 가능
    
    try {
        Object.entries(appState.connections).forEach(([peerId, conn]) => {
            // 발신자에게는 다시 보내지 않음
            if (peerId !== senderPeerId) {
                sendData(conn, message);
            }
        });
    } catch (error) {
        console.error('메시지 중계 중 오류:', error);
    }
}

/**
 * 시스템 메시지 처리
 * @param {Object} message - 시스템 메시지
 * @param {string} fromPeerId - 발신자 피어 ID
 */
function handleSystemMessage(message, fromPeerId) {
    try {
        // 호스트가 다른 모든 피어에게 시스템 메시지 중계 
        // (일부 시스템 메시지는 중계할 필요가 있음)
        if (appState.isHost && 
            (message.action === 'user_info' || 
             message.action === 'peer_disconnect' || 
             message.action === 'status_change' || 
             message.action === 'typing')) {
            relayMessageToAllPeers(message, fromPeerId);
        }
        
        switch (message.action) {
            case 'user_info':
                // 사용자 정보 업데이트
                const isNewUser = !appState.users[message.userId];
                // 사용자 정보 저장
                appState.users[message.userId] = {
                    name: message.userName,
                    avatar: message.userAvatar || null,
                    status: message.userStatus || 'online',
                    role: message.isAdmin ? 'admin' : (message.isHost ? 'host' : 'user')
                };
                
                // UI 업데이트
                updateUsersList();
                
                // 상태 표시기 업데이트
                if (message.userStatus) {
                    updateStatusIndicator(message.userId, message.userStatus);
                }
                
                // 새 사용자 안내 메시지
                if (isNewUser && message.userId !== appState.localUserId) {
                    addSystemMessage(t('user_joined', { user: message.userName }));
                    
                    // 호스트가 아니고, 새로운 유저가 호스트가 아닌 경우
                    // 메시 네트워크를 구축하기 위해 직접 연결 시도
                    if (!appState.isHost && message.userId !== appState.roomId) {
                        connectToPeer(message.userId);
                    }
                    
                    // 호스트인 경우, 새로운 사용자에게 메시지 히스토리 전송
                    if (appState.isHost) {
                        setTimeout(() => {
                            sendMessageHistory(message.userId);
                        }, 1000);
                        
                        // 다른 모든 사용자에게 새 사용자 연결 알림
                        const newPeerMessage = {
                            type: 'system',
                            action: 'new_peer_connected',
                            userId: message.userId
                        };
                        relayMessageToAllPeers(newPeerMessage, message.userId);
                    }
                }
                break;
                
            case 'peer_disconnect':
                // 피어 연결 종료 알림
                if (message.userId) {
                    handlePeerDisconnect(message.userId);
                    
                    // 호스트 탈퇴 시 새 호스트 선출
                    if (message.userId === appState.roomId && !appState.isHost) {
                        electNewHost();
                    }
                }
                break;
                
            case 'host_change':
                // 호스트 변경 알림
                handleHostChange(message);
                break;
                
            case 'host_transfer':
                // 방장 권한 이임
                handleHostTransfer(message);
                break;
                
            case 'host_info':
                // 호스트 정보 수신
                if (message.userId && message.isHost) {
                    console.log(`${message.userId}가 호스트입니다.`);
                    
                    // 사용자 역할 업데이트
                    if (appState.users[message.userId]) {
                        appState.users[message.userId].role = 'host';
                        updateUsersList();
                    }
                }
                break;
                
            case 'new_peer_connected':
                // 새 피어 연결 알림 (메시 네트워크 구축용)
                if (!appState.isHost && message.userId !== appState.localUserId) {
                    console.log('새 피어 연결 알림:', message.userId);
                    connectToPeer(message.userId);
                }
                break;
                
            case 'status_change':
                // 사용자 상태 변경 알림
                if (message.userId && message.status) {
                    // 사용자 정보 업데이트
                    if (appState.users[message.userId]) {
                        appState.users[message.userId].status = message.status;
                    }
                    
                    // 상태 표시기 업데이트
                    updateStatusIndicator(message.userId, message.status);
                }
                break;
                
            case 'typing':
                // 타이핑 상태 업데이트
                if (message.userId && message.userName) {
                    // 타이핑 정보 저장
                    appState.typing.users[message.userId] = {
                        userName: message.userName,
                        isTyping: message.isTyping,
                        channel: message.channel || 'general'
                    };
                    
                    // 타이핑 인디케이터 업데이트
                    updateTypingIndicator();
                }
                break;
                
            case 'sync_deleted_messages':
                // 삭제된 메시지 목록 동기화
                if (message.deletedMessages) {
                    appState.deletedMessages = {
                        ...appState.deletedMessages,
                        ...message.deletedMessages
                    };
                    
                    // UI에서 삭제된 메시지 처리
                    Object.keys(message.deletedMessages).forEach(messageId => {
                        const messageElement = document.getElementById(`message-${messageId}`);
                        if (messageElement) {
                            const messageText = messageElement.querySelector('.message-text');
                            if (messageText) {
                                messageText.innerHTML = `<em class="deleted-message">${t('deleted_message')}</em>`;
                            }
                            
                            // 삭제 버튼 제거
                            const deleteBtn = messageElement.querySelector('.message-delete-btn');
                            if (deleteBtn) {
                                deleteBtn.remove();
                            }
                        }
                    });
                }
                break;
                
            default:
                console.warn('알 수 없는 시스템 메시지 액션:', message.action);
        }
    } catch (error) {
        console.error('시스템 메시지 처리 중 오류:', error);
    }
}

/**
 * 호스트 변경 처리
 * @param {Object} message - 호스트 변경 메시지
 */
function handleHostChange(message) {
    try {
        // 기존 호스트 확인
        const oldHostId = appState.roomId;
        const oldHostName = appState.users[oldHostId]?.name || t('previous_host');
        
        // 새 호스트 정보 업데이트
        const newHostId = message.newHostId;
        appState.roomId = newHostId;
        
        // 자신이 새 호스트가 되었는지 확인
        if (newHostId === appState.localUserId) {
            appState.isHost = true;
            appState.isAdmin = true;
            showToast(t('host_permission_granted'));
        }
        
        // 사용자 역할 업데이트
        if (appState.users[oldHostId]) {
            appState.users[oldHostId].role = 'user';
        }
        
        if (appState.users[newHostId]) {
            appState.users[newHostId].role = 'host';
        }
        
        // 사용자 목록 업데이트
        updateUsersList();
        
        // 시스템 메시지 표시
        const newHostName = appState.users[newHostId]?.name || t('new_host');
        addSystemMessage(t('host_changed', { from: oldHostName, to: newHostName }));
        
        // URL 주소 업데이트
        updateUrlWithRoomId(newHostId);
    } catch (error) {
        console.error('호스트 변경 처리 중 오류:', error);
    }
}

/**
 * 방장 권한 이임 처리
 * @param {Object} message - 방장 이임 메시지
 */
function handleHostTransfer(message) {
    try {
        // 현재 방장 확인
        const currentHostId = message.currentHostId;
        const currentHostName = appState.users[currentHostId]?.name || t('previous_host');
        
        // 새 방장 정보 업데이트
        const newHostId = message.newHostId;
        appState.roomId = newHostId;
        
        // 자신이 새 방장이 되었는지 확인
        if (newHostId === appState.localUserId) {
            appState.isHost = true;
            appState.isAdmin = true;
            showToast(t('host_permission_granted'));
        } else {
            // 이전 방장이 자신이었으면 호스트 권한 제거, 관리자로 변경
            if (currentHostId === appState.localUserId) {
                appState.isHost = false;
            }
        }
        
        // 사용자 역할 업데이트
        if (appState.users[currentHostId]) {
            appState.users[currentHostId].role = 'admin'; // 이전 방장은 관리자로
        }
        
        if (appState.users[newHostId]) {
            appState.users[newHostId].role = 'host';
        }
        
        // 사용자 목록 업데이트
        updateUsersList();
        
        // 시스템 메시지 표시
        const newHostName = appState.users[newHostId]?.name || t('new_host');
        addSystemMessage(t('host_transferred', { from: currentHostName, to: newHostName }));
        
        // URL 주소 업데이트
        updateUrlWithRoomId(newHostId);
    } catch (error) {
        console.error('방장 권한 이임 처리 중 오류:', error);
    }
}

/**
 * 새 호스트 선출
 */
function electNewHost() {
    try {
        // 호스트가 아닌 경우만 실행
        if (appState.isHost) return;
        
        // 현재 연결된 사용자 중에서 새 호스트 선택
        const connectedUsers = Object.keys(appState.connections);
        
        // 연결된 사용자가 없으면 자신이 호스트가 됨
        if (connectedUsers.length === 0) {
            becomeNewHost();
            return;
        }
        
        // 새 호스트 선정 (간단하게 ID 기준 알파벳 순으로 첫번째)
        const potentialHosts = [...connectedUsers, appState.localUserId].sort();
        const newHostId = potentialHosts[0];
        
        // 자신이 새 호스트로 선정된 경우
        if (newHostId === appState.localUserId) {
            becomeNewHost();
        }
    } catch (error) {
        console.error('새 호스트 선출 중 오류:', error);
    }
}

/**
 * 새 호스트가 되는 과정
 */
function becomeNewHost() {
    try {
        // 이미 호스트인 경우 무시
        if (appState.isHost) return;
        
        // 방장 정보 업데이트
        appState.isHost = true;
        appState.isAdmin = true;
        
        // 사용자 역할 업데이트
        if (appState.users[appState.localUserId]) {
            appState.users[appState.localUserId].role = 'host';
        }
        
        // 사용자 목록 업데이트
        updateUsersList();
        
        // 호스트 변경 알림 전송
        broadcastMessage({
            type: 'system',
            action: 'host_change',
            newHostId: appState.localUserId,
            newHostName: appState.localUserName
        });
        
        // 시스템 메시지 및 알림
        addSystemMessage(t('previous_host_left'));
        addSystemMessage(t('you_are_new_host'));
        showToast(t('you_are_new_host'));
        
        // URL 주소 업데이트
        updateUrlWithRoomId(appState.localUserId);
    } catch (error) {
        console.error('새 호스트 되기 중 오류:', error);
    }
}

/**
 * 피어 연결 종료 처리
 * @param {string} peerId - 연결 종료된 피어 ID
 */
function handlePeerDisconnect(peerId) {
    try {
        // 음성 채널에서 사용자 제거
        Object.keys(appState.voiceChannels).forEach(channelId => {
            if (appState.voiceChannels[channelId].users) {
                appState.voiceChannels[channelId].users = 
                    appState.voiceChannels[channelId].users.filter(id => id !== peerId);
            }
        });
        
        // 음성 연결 종료
        if (appState.voiceConnections[peerId]) {
            if (appState.voiceConnections[peerId].mediaConnection) {
                appState.voiceConnections[peerId].mediaConnection.close();
            }
            delete appState.voiceConnections[peerId];
        }
        
        // 사용자가 존재하는 경우 사용자 목록에서 제거
        if (appState.users[peerId]) {
            const userName = appState.users[peerId].name;
            const userRole = appState.users[peerId].role;
            delete appState.users[peerId];
            
            // 타이핑 상태 제거
            if (appState.typing.users[peerId]) {
                delete appState.typing.users[peerId];
                updateTypingIndicator();
            }
            
            // 사용자 목록 업데이트
            updateUsersList();
            
            // 음성 채널 목록 업데이트
            updateVoiceChannelsList();
            
            // 음성 사용자 UI 업데이트
            updateVoiceUsers();
            
            // 호스트가 아닌 경우, 호스트와의 연결 종료 감지
            if (!appState.isHost && peerId === appState.roomId) {
                // 호스트가 나갔을 때 새 호스트 선출 시도
                electNewHost();
            } else {
                // 일반 사용자가 나간 경우 메시지 표시
                let message = t('user_left', { user: userName });
                if (userRole === 'host') {
                    message += ` (${t('host')})`;
                } else if (userRole === 'admin') {
                    message += ` (${t('admin')})`;
                }
                addSystemMessage(message);
                
                // 접속 종료 효과음
                playNotificationSound('disconnect');
            }
        }
        
        // 연결 객체에서 제거
        if (appState.connections[peerId]) {
            delete appState.connections[peerId];
        }
        
        // 연결 상태 업데이트
        updateConnectionStatusFromPeers();
    } catch (error) {
        console.error('피어 연결 종료 처리 중 오류:', error);
    }
}

/**
 * 메시지 히스토리 전송
 * @param {string} targetUserId - 대상 사용자 ID
 */
function sendMessageHistory(targetUserId) {
    try {
        if (!appState.isHost || !appState.connections[targetUserId]) return;
        
        // 메시지 히스토리 구성
        const history = {
            type: 'history',
            messages: appState.messageHistory.filter(msg => !msg.deleted),
            channels: {},
            deletedMessages: appState.deletedMessages
        };
        
        // 채널별 메시지 추가
        Object.keys(appState.channels).forEach(channelId => {
            history.channels[channelId] = {
                name: appState.channels[channelId].name,
                messages: appState.channels[channelId].messages.filter(msg => !msg.deleted) || []
            };
        });
        
        // 특정 사용자에게만 히스토리 전송
        sendData(appState.connections[targetUserId], history);
    } catch (error) {
        console.error('메시지 히스토리 전송 중 오류:', error);
    }
}

/**
 * 파일 메시지 처리
 * @param {Object} message - 파일 메시지
 * @param {string} fromPeerId - 발신자 피어 ID
 */
function handleFileMessage(message, fromPeerId) {
    try {
        // 호스트가 다른 모든 피어에게 파일 메시지 중계 (이미 handleReceivedMessage에서 처리)
        
        switch (message.action) {
            case 'file_info':
                // 파일 정보 수신 (파일 전송 시작)
                console.log('파일 정보 수신:', message);
                
                // 메시지 ID 생성
                if (!message.messageId) {
                    message.messageId = generateMessageId();
                }
                
                // 파일 청크 저장소 초기화
                appState.fileChunks[message.fileId] = {
                    fileName: message.fileName,
                    fileType: message.fileType,
                    fileSize: message.fileSize,
                    chunks: [],
                    receivedChunks: 0,
                    totalChunks: message.totalChunks,
                    messageId: message.messageId
                };
                
                // 이미지 파일인지 확인
                const isImage = message.fileType.startsWith('image/');
                const isGif = message.fileType === 'image/gif';
                
                // 파일 전송 시작 메시지 표시
                if (isImage) {
                    // 이미지 파일일 경우 로딩 표시
                    addImageLoadingMessage(
                        message.userName,
                        message.fileName,
                        message.fileSize,
                        message.fileId,
                        0,
                        message.messageId,
                        message.userId,
                        isGif
                    );
                } else {
                    // 일반 파일일 경우 다운로드 표시
                    addFileTransferMessage(
                        message.userName,
                        message.fileName,
                        message.fileSize,
                        message.fileId,
                        0,
                        message.messageId,
                        message.userId
                    );
                }
                break;
                
            case 'file_chunk':
                // 파일 청크 수신
                const fileInfo = appState.fileChunks[message.fileId];
                if (fileInfo) {
                    // 청크 저장
                    fileInfo.chunks[message.chunkIndex] = message.data;
                    fileInfo.receivedChunks++;
                    
                    // 진행 상태 업데이트
                    const progress = (fileInfo.receivedChunks / fileInfo.totalChunks) * 100;
                    updateFileTransferProgress(message.fileId, progress);
                    
                    // 모든 청크 수신 완료
                    if (fileInfo.receivedChunks === fileInfo.totalChunks) {
                        console.log('파일 수신 완료:', message.fileId);
                        
                        // 파일 재조립
                        const fileData = new Blob(fileInfo.chunks, { type: fileInfo.fileType });
                        const fileUrl = URL.createObjectURL(fileData);
                        
                        // 이미지인 경우 미리보기만 표시
                        if (fileInfo.fileType.startsWith('image/')) {
                            // 이미지 미리보기 추가
                            addImagePreview(message.fileId, fileUrl, fileInfo.fileType === 'image/gif');
                        } else {
                            // 일반 파일이면 다운로드 링크 업데이트
                            updateFileDownloadLink(message.fileId, fileUrl, fileInfo.fileName);
                        }
                        
                        // 청크 데이터 정리 (메모리 누수 방지)
                        delete appState.fileChunks[message.fileId].chunks;
                    }
                }
                break;
                
            default:
                console.warn('알 수 없는 파일 메시지 액션:', message.action);
        }
    } catch (error) {
        console.error('파일 메시지 처리 중 오류:', error);
    }
}

/**
 * 메시지 ID 생성
 * @return {string} 생성된 메시지 ID
 */
function generateMessageId() {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 채팅 메시지 전송
 */
function sendChatMessage() {
    try {
        if (!UI.messageInput) return;
        
        const messageText = UI.messageInput.value.trim();
        if (!messageText) return;
        
        // 타임아웃 상태 확인
        if (UI.messageInput.disabled) {
            showToast(t('message_limit'));
            return;
        }
        
        // 연결이 없는 경우 처리
        if (!appState.connectionEstablished) {
            showToast(t('connection_not_established'));
            return;
        }
        
        if (Object.keys(appState.connections).length === 0 && !appState.isHost) {
            showToast(t('no_connected_users'));
            return;
        }
        
        // 메시지 ID 생성
        const messageId = generateMessageId();
        
        const chatMessage = {
            type: 'chat',
            messageId: messageId,
            content: messageText,
            userName: appState.localUserName,
            userId: appState.localUserId,
            timestamp: Date.now(),
            channel: appState.currentChannel // 현재 채널 정보 추가
        };
        
        try {
            // 메시지를 모든 피어에게 전송
            broadcastMessage(chatMessage);
            
            // 자신의 메시지 표시
            addChatMessage(appState.localUserName, messageText, chatMessage.timestamp, messageId, appState.localUserId);
            
            // 메시지 히스토리에 추가
            if (appState.currentChannel && appState.channels[appState.currentChannel]) {
                // 채널 메시지
                appState.channels[appState.currentChannel].messages.push(chatMessage);
            } else {
                // 기본 메시지
                appState.messageHistory.push(chatMessage);
            }
            
            // 입력 필드 초기화
            UI.messageInput.value = '';
            
            // 타이핑 상태 종료
            sendTypingStatus(false);
        } catch (err) {
            console.error('메시지 전송 중 오류:', err);
            showToast(t('message_send_error'));
        }
    } catch (error) {
        console.error('채팅 메시지 전송 중 오류:', error);
    }
}

/**
 * 메시지 삭제 요청
 * @param {string} messageId - 삭제할 메시지 ID
 * @param {string} channelId - 채널 ID
 */
function deleteMessage(messageId, channelId) {
    try {
        // 메시지 유효성 검증
        if (!messageId) return;
        
        // 메시지 찾기
        let messageToDelete = null;
        let userId = null;
        
        // 채널 메시지 확인
        if (channelId && appState.channels[channelId]) {
            const message = appState.channels[channelId].messages.find(msg => msg.messageId === messageId);
            if (message) {
                messageToDelete = message;
                userId = message.userId;
            }
        } else {
            // 일반 메시지 확인
            const message = appState.messageHistory.find(msg => msg.messageId === messageId);
            if (message) {
                messageToDelete = message;
                userId = message.userId;
            }
        }
        
        // 삭제 권한 확인 (자신의 메시지이거나 관리자/호스트)
        const isOwnMessage = userId === appState.localUserId;
        const hasPermission = isOwnMessage || appState.isAdmin || appState.isHost;
        
        if (!hasPermission) {
            showToast(t('no_delete_permission'));
            return;
        }
        
        // 삭제 메시지 브로드캐스트
        const deleteRequest = {
            type: 'delete',
            messageId: messageId,
            channel: channelId,
            byAdmin: !isOwnMessage // 관리자에 의한 삭제 여부
        };
        
        broadcastMessage(deleteRequest);
        
        // 로컬에서도 삭제 처리
        handleDeleteMessage(deleteRequest);
    } catch (error) {
        console.error('메시지 삭제 요청 중 오류:', error);
    }
}

/**
 * 파일 선택 처리
 * @param {Event} e - 이벤트 객체
 */
function handleFileSelection(e) {
    try {
        const file = e.target.files[0];
        if (!file) return;
        
        console.log('파일 선택됨:', file.name, file.type,file.size);
        
        // 파일 크기 제한 (예: 30MB)
        const MAX_FILE_SIZE = 30 * 1024 * 1024;
        if (file.size > MAX_FILE_SIZE) {
            showToast(t('file_size_limit', { size: '30MB' }));
            return;
        }
        
        // 파일 ID 및 메시지 ID 생성
        const fileId = `file_${Date.now()}`;
        const messageId = generateMessageId();
        
        // 청크 크기 및 총 청크 수 계산
        const CHUNK_SIZE = 16 * 1024; // 16KB
        const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
        
        // 파일 정보 메시지 생성
        const fileInfoMessage = {
            type: 'file',
            action: 'file_info',
            fileId: fileId,
            messageId: messageId,
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size,
            totalChunks: totalChunks,
            userName: appState.localUserName,
            userId: appState.localUserId,
            timestamp: Date.now(),
            channel: appState.currentChannel
        };
        
        // 파일 정보 메시지 broadcast
        broadcastMessage(fileInfoMessage);
        
        // 이미지 파일인지 확인 및 처리
        const isImage = file.type.startsWith('image/');
        const isGif = file.type === 'image/gif';
        
        // 파일 전송 시작 메시지 표시
        if (isImage) {
            // 이미지 파일일 경우 로딩 표시
            addImageLoadingMessage(
                appState.localUserName,
                file.name,
                file.size,
                fileId,
                0,
                messageId,
                appState.localUserId,
                isGif
            );
        } else {
            // 일반 파일일 경우 다운로드 표시
            addFileTransferMessage(
                appState.localUserName,
                file.name,
                file.size,
                fileId,
                0,
                messageId,
                appState.localUserId
            );
        }
        
        // 파일 읽기 및 청크 전송
        const reader = new FileReader();
        let chunkIndex = 0;
        
        const readNextChunk = () => {
            const start = chunkIndex * CHUNK_SIZE;
            const end = Math.min(start + CHUNK_SIZE, file.size);
            const chunk = file.slice(start, end);
            
            reader.onload = (e) => {
                // 파일 청크 메시지 생성
                const fileChunkMessage = {
                    type: 'file',
                    action: 'file_chunk',
                    fileId: fileId,
                    chunkIndex: chunkIndex,
                    data: e.target.result,
                    userName: appState.localUserName
                };
                
                // 청크 전송
                broadcastMessage(fileChunkMessage);
                
                // 진행 상태 업데이트
                const progress = ((chunkIndex + 1) / totalChunks) * 100;
                updateFileTransferProgress(fileId, progress);
                
                // 다음 청크 처리
                chunkIndex++;
                if (chunkIndex < totalChunks) {
                    setTimeout(readNextChunk, 10); // 약간의 지연으로 UI 블로킹 방지
                } else {
                    console.log('파일 전송 완료:', fileId);
                    
                    // 파일 URL 생성
                    const fileUrl = URL.createObjectURL(file);
                    
                    // 이미지인 경우 미리보기만 표시
                    if (isImage) {
                        addImagePreview(fileId, fileUrl, isGif);
                    } else {
                        // 일반 파일이면 다운로드 링크 업데이트
                        updateFileDownloadLink(fileId, fileUrl, file.name);
                    }
                }
            };
            
            reader.readAsArrayBuffer(chunk);
        };
        
        // 첫 번째 청크 읽기 시작
        readNextChunk();
        
        // 파일 입력 필드 초기화
        if (UI.fileInput) UI.fileInput.value = '';
    } catch (error) {
        console.error('파일 선택 처리 중 오류:', error);
        showToast(t('file_process_error'), 3000, 'error');
    }
}

/**
 * 이미지 로딩 메시지 추가
 * @param {string} userName - 사용자 이름
 * @param {string} fileName - 파일 이름
 * @param {number} fileSize - 파일 크기
 * @param {string} fileId - 파일 ID
 * @param {number} progress - 진행 상태
 * @param {string} messageId - 메시지 ID
 * @param {string} userId - 사용자 ID
 * @param {boolean} isGif - GIF 이미지 여부
 */
function addImageLoadingMessage(userName, fileName, fileSize, fileId, progress, messageId, userId, isGif) {
    try {
        if (!UI.chatMessages) return;
        
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message';
        messageDiv.id = `file-message-${fileId}`;
        
        // 메시지 ID 설정 (있는 경우)
        if (messageId) {
            messageDiv.dataset.messageId = messageId;
        }
        
        // 사용자 ID 설정 (있는 경우)
        if (userId) {
            messageDiv.dataset.userId = userId;
        }
        
        // 채널 설정
        messageDiv.dataset.channel = appState.currentChannel;
        
        const time = new Date();
        const timeString = `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`;
        const formattedSize = formatFileSize(fileSize);
        
        // 자신의 파일인지 확인
        const isMe = userName === appState.localUserName;
        
        // 관리자 또는 호스트 여부 확인
        const isAdmin = appState.users[userId] && (appState.users[userId].role === 'admin' || appState.users[userId].role === 'host');
        
        // 사용자 색상
        const userColor = getColorFromName(userName);
        
        // 아바타 배경 설정
        let avatarStyle = '';
        if (userId && appState.users[userId] && appState.users[userId].avatar) {
            avatarStyle = `background-image: url(${escapeHtml(appState.users[userId].avatar)}); background-color: transparent;`;
        } else {
            avatarStyle = `background-color: ${userColor};`;
        }
        
        // 사용자 역할 배지
        let userBadge = '';
        if (userId && appState.users[userId]) {
            if (appState.users[userId].role === 'host') {
                userBadge = `<span class="user-role-badge host">${t('host')}</span>`;
            } else if (appState.users[userId].role === 'admin') {
                userBadge = `<span class="user-role-badge admin">${t('admin')}</span>`;
            }
        }
        
        // 삭제 버튼 (자신의 메시지 또는 관리자/호스트인 경우)
        let deleteButton = '';
        if (messageId && (isMe || appState.isAdmin || appState.isHost) && !appState.deletedMessages[messageId]) {
            deleteButton = `<button class="message-delete-btn" onclick="deleteMessage('${messageId}', '${appState.currentChannel}')">${t('delete')}</button>`;
        }
        
        messageDiv.innerHTML = `
            <div class="message-avatar" style="${avatarStyle}"></div>
            <div class="message-content">
                <div class="message-header">
                    <span class="message-author" style="color: ${userColor}">${escapeHtml(userName)}${isMe ? ` (${t('me')})` : ''}${userBadge}</span>
                    <span class="message-time">${timeString}</span>
                    ${deleteButton}
                </div>
                <div class="image-loading-container">
                    <div class="image-loading-info">
                        <div class="file-icon">${isGif ? '🎞️' : '🖼️'}</div>
                        <div class="file-info">
                            <div class="file-name">${escapeHtml(fileName)}</div>
                            <div class="file-size">${formattedSize}</div>
                            <div class="progress-container">
                                <div class="progress-bar" style="width: ${progress}%"></div>
                            </div>
                        </div>
                    </div>
                    <div id="preview-${fileId}" class="file-preview"></div>
                </div>
            </div>
        `;
        
        // 현재 채널이 메시지의 채널과 일치하는 경우에만 표시
        if (appState.currentChannel === (messageDiv.dataset.channel || 'general')) {
            UI.chatMessages.appendChild(messageDiv);
            scrollToBottom();
        }
    } catch (error) {
        console.error('이미지 로딩 메시지 추가 중 오류:', error);
    }
}

/**
 * 모든 연결에 메시지 브로드캐스트
 * @param {Object} message - 브로드캐스트할 메시지
 */
function broadcastMessage(message) {
    try {
        if (appState.isHost) {
            // 호스트인 경우: 모든 연결된 피어에게 전송
            Object.values(appState.connections).forEach(conn => {
                sendData(conn, message);
            });
        } else {
            // 일반 유저인 경우: 호스트에게만 전송 (호스트가 중계)
            const hostConn = appState.connections[appState.roomId];
            if (hostConn) {
                sendData(hostConn, message);
            } else {
                console.warn('호스트와 연결되지 않았습니다. 메시지 전송 불가.');
                // 연결이 없는 경우 큐에 저장
                appState.pendingMessages.push(message);
                
                // 연결 재시도 요청
                showToast(t('server_disconnected_reconnecting'), 0, 'warning');
                
                // 자동 재연결 시도
                if (appState.peer && appState.peer.disconnected) {
                    appState.peer.reconnect();
                }
            }
        }
    } catch (error) {
        console.error('메시지 브로드캐스트 중 오류:', error);
    }
}

/**
 * 데이터 전송
 * @param {Object} connection - 연결 객체
 * @param {Object} data - 전송할 데이터
 * @return {boolean} 전송 성공 여부
 */
function sendData(connection, data) {
    try {
        if (!connection) {
            console.warn('연결 객체가 유효하지 않습니다.');
            return false;
        }
        
        connection.send(data);
        return true;
    } catch (error) {
        console.error('데이터 전송 중 오류:', error);
        return false;
    }
}

/**
 * 초대 모달 표시
 */
function showInviteModal() {
    try {
        // 방 ID가 없으면 모달을 표시하지 않음
        if (!appState.roomId) return;
        
        // 초대 코드 설정
        if (UI.inviteCode) {
            UI.inviteCode.textContent = appState.roomId;
        }
        
        // 초대 링크 설정
        let inviteLink;
        if (window.location.protocol === 'file:') {
            // 로컬 파일 실행 시 도메인 부분은 고정 값 사용
            inviteLink = `${DOMAIN}/#${appState.roomId}`;
        } else {
            inviteLink = `${window.location.origin}/#${appState.roomId}`;
        }
        
        if (UI.inviteLink) {
            UI.inviteLink.textContent = inviteLink;
        }
        
        // QR 코드 생성
        generateQRCode(inviteLink);
        
        // 모달 표시
        if (UI.inviteModal) {
            UI.inviteModal.classList.remove('hidden');
        }
    } catch (error) {
        console.error('초대 모달 표시 중 오류:', error);
    }
}

/**
 * QR 코드 생성
 * @param {string} data - QR 코드에 포함될 데이터
 */
function generateQRCode(data) {
    try {
        if (!UI.qrContainer) return;
        
        UI.qrContainer.innerHTML = '';
        
        // QRCode 라이브러리가 있는지 확인
        if (typeof QRCode === 'undefined') {
            console.error('QRCode 라이브러리를 찾을 수 없습니다.');
            UI.qrContainer.innerHTML = `<p>${t('qr_code_generation_failed')}</p>`;
            return;
        }
        
        new QRCode(UI.qrContainer, {
            text: data,
            width: 128,
            height: 128,
            colorDark: '#5865F2',
            colorLight: '#ffffff',
            correctLevel: QRCode.CorrectLevel.H
        });
    } catch (e) {
        console.error('QR 코드 생성 실패:', e);
        if (UI.qrContainer) {
            UI.qrContainer.innerHTML = `<p>${t('qr_code_generation_failed')}</p>`;
        }
    }
}

/**
 * URL 경로 업데이트
 * @param {string} roomId - 방 ID
 */
function updateUrlWithRoomId(roomId) {
    try {
        // 로컬 파일에서 실행 여부 확인 (file:// 프로토콜)
        if (window.location.protocol !== 'file:') {
            const newUrl = `${window.location.origin}/#${roomId}`;
            window.history.pushState({ roomId }, '', newUrl);
        } else {
            console.log('로컬 환경에서는 URL 업데이트가 불가능합니다.');
            // URL 업데이트 건너뛰기 (로컬 테스트 환경에서)
        }
    } catch (error) {
        console.warn('URL 업데이트 중 오류:', error);
        // 오류 발생 시 무시하고 계속 진행
    }
}

/**
 * 기존 연결 정리
 */
function cleanupConnections() {
    try {
        // 음성 채널에 연결되어 있으면 종료
        if (appState.currentVoiceChannel) {
            leaveVoiceChannel();
        }
        
        // PeerJS 인스턴스 제거
        if (appState.peer) {
            appState.peer.destroy();
            appState.peer = null;
        }
        
        // 연결 상태 초기화
        appState.connections = {};
        appState.users = {};
        appState.fileChunks = {};
        appState.typing.users = {};
        appState.connectionEstablished = false;
        
        // UI 초기화
        updateUsersList();
        updateVoiceChannelsList();
        updateTypingIndicator();
    } catch (error) {
        console.error('연결 정리 중 오류:', error);
    }
}

/**
 * 채팅 메시지 추가
 * @param {string} userName - 사용자 이름
 * @param {string} text - 메시지 내용
 * @param {number} timestamp - 타임스탬프
 * @param {string} messageId - 메시지 ID
 * @param {string} userId - 사용자 ID
 */
function addChatMessage(userName, text, timestamp, messageId, userId) {
    try {
        if (!UI.chatMessages) return;
        
        // 삭제된 메시지인지 확인
        if (messageId && appState.deletedMessages[messageId]) {
            text = t('deleted_message');
        }
        
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message';
        
        // 메시지 ID 설정 (있는 경우)
        if (messageId) {
            messageDiv.id = `message-${messageId}`;
            messageDiv.dataset.messageId = messageId;
        }
        
        // 사용자 ID 설정 (있는 경우)
        if (userId) {
            messageDiv.dataset.userId = userId;
        }
        
        // 채널 설정
        messageDiv.dataset.channel = appState.currentChannel;
        
        const time = new Date(timestamp);
        const timeString = `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`;
        
        // 자신의 메시지인지 확인
        const isMe = userName === appState.localUserName;
        
        // 관리자 또는 호스트 여부 확인
        const isAdmin = appState.users[userId] && (appState.users[userId].role === 'admin' || appState.users[userId].role === 'host');
        
        // 사용자 색상
        const userColor = getColorFromName(userName);
        
        // 아바타 배경 설정
        let avatarStyle = '';
        if (userId && appState.users[userId] && appState.users[userId].avatar) {
            avatarStyle = `background-image: url(${escapeHtml(appState.users[userId].avatar)}); background-color: transparent;`;
        } else {
            avatarStyle = `background-color: ${userColor};`;
        }
        
        // 사용자 역할 배지
        let userBadge = '';
        if (userId && appState.users[userId]) {
            if (appState.users[userId].role === 'host') {
                userBadge = `<span class="user-role-badge host">${t('host')}</span>`;
            } else if (appState.users[userId].role === 'admin') {
                userBadge = `<span class="user-role-badge admin">${t('admin')}</span>`;
            }
        }
        
        // 삭제 버튼 (자신의 메시지 또는 관리자/호스트인 경우)
        let deleteButton = '';
        if (messageId && (isMe || appState.isAdmin || appState.isHost) && !appState.deletedMessages[messageId]) {
            deleteButton = `<button class="message-delete-btn" onclick="deleteMessage('${messageId}', '${appState.currentChannel}')">${t('delete')}</button>`;
        }
        
        // 이모지 변환 (텍스트에 이모지가 있으면 크게 표시)
        let processedText = text;
        
        // 링크 변환 (URL을 클릭 가능한 링크로 변환)
        processedText = processedText.replace(
            /(https?:\/\/[^\s]+)/g, 
            '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
        );
        
        // 순수 이모지만 있는지 확인 (이모지 + 공백)
        const emojiRegex = /^(\p{Emoji}|\s)+$/u;
        const isOnlyEmoji = emojiRegex.test(text);
        
        // 이모지만 있는 경우 큰 이모지 클래스 추가
        const messageTextClass = isOnlyEmoji ? 'message-text big-emoji' : 'message-text';
        
        messageDiv.innerHTML = `
            <div class="message-avatar" style="${avatarStyle}"></div>
            <div class="message-content">
                <div class="message-header">
                    <span class="message-author" style="color: ${userColor}">${escapeHtml(userName)}${isMe ? ` (${t('me')})` : ''}${userBadge}</span>
                    <span class="message-time">${timeString}</span>
                    ${deleteButton}
                </div>
                <div class="${messageTextClass}">${appState.deletedMessages[messageId] ? `<em class="deleted-message">${t('deleted_message')}</em>` : escapeHtml(processedText)}</div>
            </div>
        `;
        
        // 현재 채널이 메시지의 채널과 일치하는 경우에만 표시
        if (appState.currentChannel === (messageDiv.dataset.channel || 'general')) {
            UI.chatMessages.appendChild(messageDiv);
            scrollToBottom();
        }
    } catch (error) {
        console.error('채팅 메시지 추가 중 오류:', error);
    }
}

/**
 * 시스템 메시지 추가
 * @param {string} text - 메시지 내용
 */
function addSystemMessage(text) {
    try {
        if (!UI.chatMessages) return;
        
        const messageDiv = document.createElement('div');
        messageDiv.className = 'system-message';
        messageDiv.textContent = text;
        
        UI.chatMessages.appendChild(messageDiv);
        scrollToBottom();
    } catch (error) {
        console.error('시스템 메시지 추가 중 오류:', error);
    }
}

/**
 * 파일 전송 메시지 추가
 * @param {string} userName - 사용자 이름
 * @param {string} fileName - 파일 이름
 * @param {number} fileSize - 파일 크기
 * @param {string} fileId - 파일 ID
 * @param {number} progress - 진행 상태
 * @param {string} messageId - 메시지 ID
 * @param {string} userId - 사용자 ID
 */
function addFileTransferMessage(userName, fileName, fileSize, fileId, progress, messageId, userId) {
    try {
        if (!UI.chatMessages) return;
        
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message';
        messageDiv.id = `file-message-${fileId}`;
        
        // 메시지 ID 설정 (있는 경우)
        if (messageId) {
            messageDiv.dataset.messageId = messageId;
        }
        
        // 사용자 ID 설정 (있는 경우)
        if (userId) {
            messageDiv.dataset.userId = userId;
        }
        
        // 채널 설정
        messageDiv.dataset.channel = appState.currentChannel;
        
        const time = new Date();
        const timeString = `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`;
        const formattedSize = formatFileSize(fileSize);
        
        // 자신의 파일인지 확인
        const isMe = userName === appState.localUserName;
        
        // 관리자 또는 호스트 여부 확인
        const isAdmin = appState.users[userId] && (appState.users[userId].role === 'admin' || appState.users[userId].role === 'host');
        
        // 사용자 색상
        const userColor = getColorFromName(userName);
        
        // 아바타 배경 설정
        let avatarStyle = '';
        if (userId && appState.users[userId] && appState.users[userId].avatar) {
            avatarStyle = `background-image: url(${escapeHtml(appState.users[userId].avatar)}); background-color: transparent;`;
        } else {
            avatarStyle = `background-color: ${userColor};`;
        }
        
        // 사용자 역할 배지
        let userBadge = '';
        if (userId && appState.users[userId]) {
            if (appState.users[userId].role === 'host') {
                userBadge = `<span class="user-role-badge host">${t('host')}</span>`;
            } else if (appState.users[userId].role === 'admin') {
                userBadge = `<span class="user-role-badge admin">${t('admin')}</span>`;
            }
        }
        
        // 삭제 버튼 (자신의 메시지 또는 관리자/호스트인 경우)
        let deleteButton = '';
        if (messageId && (isMe || appState.isAdmin || appState.isHost) && !appState.deletedMessages[messageId]) {
            deleteButton = `<button class="message-delete-btn" onclick="deleteMessage('${messageId}', '${appState.currentChannel}')">${t('delete')}</button>`;
        }
        
        messageDiv.innerHTML = `
            <div class="message-avatar" style="${avatarStyle}"></div>
            <div class="message-content">
                <div class="message-header">
                    <span class="message-author" style="color: ${userColor}">${escapeHtml(userName)}${isMe ? ` (${t('me')})` : ''}${userBadge}</span>
                    <span class="message-time">${timeString}</span>
                    ${deleteButton}
                </div>
                <div class="file-message">
                    <div class="file-icon">📎</div>
                    <div class="file-info">
                        <div class="file-name">${escapeHtml(fileName)}</div>
                        <div class="file-size">${formattedSize}</div>
                        <div class="progress-container">
                            <div class="progress-bar" style="width: ${progress}%"></div>
                        </div>
                    </div>
                    <button class="file-download" id="download-${fileId}" disabled>${t('download')}</button>
                </div>
                <div id="preview-${fileId}" class="file-preview"></div>
            </div>
        `;
        
        // 현재 채널이 메시지의 채널과 일치하는 경우에만 표시
        if (appState.currentChannel === (messageDiv.dataset.channel || 'general')) {
            UI.chatMessages.appendChild(messageDiv);
            scrollToBottom();
        }
    } catch (error) {
        console.error('파일 전송 메시지 추가 중 오류:', error);
    }
}

/**
 * 파일 전송 진행 상태 업데이트
 * @param {string} fileId - 파일 ID
 * @param {number} progress - 진행 상태
 */
function updateFileTransferProgress(fileId, progress) {
    try {
        const messageDiv = document.getElementById(`file-message-${fileId}`);
        if (!messageDiv) return;
        
        const progressBar = messageDiv.querySelector('.progress-bar');
        if (progressBar) {
            progressBar.style.width = `${progress}%`;
            
            // 전송 완료 시 로딩바 숨김
            if (progress >= 100) {
                // 완료된 경우 진행 표시줄 컨테이너 숨김
                const progressContainer = messageDiv.querySelector('.progress-container');
                if (progressContainer) {
                    setTimeout(() => {
                        progressContainer.style.display = 'none';
                    }, 1000); // 1초 후 숨김 (완료 표시 잠시 보여주기)
                }
            }
        }
    } catch (error) {
        console.error('파일 전송 진행 상태 업데이트 중 오류:', error);
    }
}

/**
 * 파일 다운로드 링크 업데이트
 * @param {string} fileId - 파일 ID
 * @param {string} fileUrl - 파일 URL
 * @param {string} fileName - 파일 이름
 */
function updateFileDownloadLink(fileId, fileUrl, fileName) {
    try {
        const downloadBtn = document.getElementById(`download-${fileId}`);
        if (!downloadBtn) return;
        
        downloadBtn.disabled = false;
        downloadBtn.onclick = () => {
            const a = document.createElement('a');
            a.href = fileUrl;
            a.download = fileName;
            a.click();
        };
    } catch (error) {
        console.error('파일 다운로드 링크 업데이트 중 오류:', error);
    }
}

/**
 * 이미지 미리보기 추가
 * @param {string} fileId - 파일 ID
 * @param {string} imageUrl - 이미지 URL
 * @param {boolean} isGif - GIF 이미지 여부
 */
function addImagePreview(fileId, imageUrl, isGif) {
    try {
        const previewDiv = document.getElementById(`preview-${fileId}`);
        if (!previewDiv) return;
        
        // 로딩 표시기 제거
        const imageLoadingContainer = document.querySelector(`.message:has(#preview-${fileId}) .image-loading-container`);
        if (imageLoadingContainer) {
            const loadingInfo = imageLoadingContainer.querySelector('.image-loading-info');
            if (loadingInfo) {
                loadingInfo.classList.add('hidden');
            }
        }
        
        // 이미지 요소 생성
        const img = document.createElement('img');
        img.src = imageUrl;
        img.className = 'image-preview';
        
        // GIF인 경우 특별 클래스 추가
        if (isGif) {
            img.classList.add('gif-preview');
        }
        
        // 클릭 시 원본 크기로 보기
        img.onclick = () => {
            showImageFullscreen(imageUrl);
        };
        
        previewDiv.appendChild(img);
        scrollToBottom();
    } catch (error) {
        console.error('이미지 미리보기 추가 중 오류:', error);
    }
}

/**
 * 이미지 전체화면 보기
 * @param {string} imageUrl - 이미지 URL
 */
function showImageFullscreen(imageUrl) {
    try {
        // 모달 컨테이너 생성
        let imageModal = document.getElementById('imageViewerModal');
        
        if (!imageModal) {
            imageModal = document.createElement('div');
            imageModal.id = 'imageViewerModal';
            imageModal.className = 'modal-overlay image-viewer-modal';
            
            imageModal.innerHTML = `
                <div class="image-viewer-container">
                    <img src="" id="fullsizeImage" class="fullsize-image" />
                    <button class="close-image-viewer">&times;</button>
                </div>
            `;
            
            document.body.appendChild(imageModal);
            
            // 닫기 버튼 이벤트
            const closeBtn = imageModal.querySelector('.close-image-viewer');
            closeBtn.addEventListener('click', () => {
                imageModal.classList.add('hidden');
            });
            
            // 모달 배경 클릭 시 닫기
            imageModal.addEventListener('click', (e) => {
                if (e.target === imageModal) {
                    imageModal.classList.add('hidden');
                }
            });
        }
        
        // 이미지 설정 및 표시
        const fullsizeImage = document.getElementById('fullsizeImage');
        if (fullsizeImage) {
            fullsizeImage.src = imageUrl;
        }
        
        imageModal.classList.remove('hidden');
    } catch (error) {
        console.error('이미지 전체화면 보기 중 오류:', error);
    }
}

/**
 * 파일 히스토리 메시지 추가 (링크없는 버전)
 * @param {string} userName - 사용자 이름
 * @param {string} fileName - 파일 이름
 * @param {number} fileSize - 파일 크기
 * @param {number} timestamp - 타임스탬프
 * @param {string} messageId - 메시지 ID
 * @param {string} userId - 사용자 ID
 */
function addFileHistoryMessage(userName, fileName, fileSize, timestamp, messageId, userId) {
    try {
        if (!UI.chatMessages) return;
        
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message';
        
        // 메시지 ID 설정 (있는 경우)
        if (messageId) {
            messageDiv.id = `message-${messageId}`;
            messageDiv.dataset.messageId = messageId;
        }
        
        // 사용자 ID 설정 (있는 경우)
        if (userId) {
            messageDiv.dataset.userId = userId;
        }
        
        // 채널 설정
        messageDiv.dataset.channel = appState.currentChannel;
        
        const time = new Date(timestamp);
        const timeString = `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`;
        const formattedSize = formatFileSize(fileSize);
        
        // 자신의 파일인지 확인
        const isMe = userName === appState.localUserName;
        
        // 관리자 또는 호스트 여부 확인
        const isAdmin = appState.users[userId] && (appState.users[userId].role === 'admin' || appState.users[userId].role === 'host');
        
        // 사용자 색상
        const userColor = getColorFromName(userName);
        
        // 아바타 배경 설정
        let avatarStyle = '';
        if (userId && appState.users[userId] && appState.users[userId].avatar) {
            avatarStyle = `background-image: url(${escapeHtml(appState.users[userId].avatar)}); background-color: transparent;`;
        } else {
            avatarStyle = `background-color: ${userColor};`;
        }
        
        // 사용자 역할 배지
        let userBadge = '';
        if (userId && appState.users[userId]) {
            if (appState.users[userId].role === 'host') {
                userBadge = `<span class="user-role-badge host">${t('host')}</span>`;
            } else if (appState.users[userId].role === 'admin') {
                userBadge = `<span class="user-role-badge admin">${t('admin')}</span>`;
            }
        }
        
        // 삭제 버튼 (자신의 메시지 또는 관리자/호스트인 경우)
        let deleteButton = '';
        if (messageId && (isMe || appState.isAdmin || appState.isHost) && !appState.deletedMessages[messageId]) {
            deleteButton = `<button class="message-delete-btn" onclick="deleteMessage('${messageId}', '${appState.currentChannel}')">${t('delete')}</button>`;
        }
        
        messageDiv.innerHTML = `
            <div class="message-avatar" style="${avatarStyle}"></div>
            <div class="message-content">
                <div class="message-header">
                    <span class="message-author" style="color: ${userColor}">${escapeHtml(userName)}${isMe ? ` (${t('me')})` : ''}${userBadge}</span>
                    <span class="message-time">${timeString}</span>
                    ${deleteButton}
                </div>
                <div class="file-message">
                    <div class="file-icon">📎</div>
                    <div class="file-info">
                        <div class="file-name">${escapeHtml(fileName)}</div>
                        <div class="file-size">${formattedSize}</div>
                        <div class="file-history-note">${t('previously_shared_file')}</div>
                    </div>
                </div>
            </div>
        `;
        
        UI.chatMessages.appendChild(messageDiv);
    } catch (error) {
        console.error('파일 히스토리 메시지 추가 중 오류:', error);
    }
}

/**
 * 메시지 히스토리 처리
 * @param {Object} message - 히스토리 메시지
 */
function handleHistoryMessage(message) {
    try {
        console.log('메시지 히스토리 수신:', message);
        
        // 삭제된 메시지 목록 저장
        if (message.deletedMessages) {
            appState.deletedMessages = {
                ...appState.deletedMessages,
                ...message.deletedMessages
            };
        }
        
        // 메시지 히스토리 설정
        if (message.messages && message.messages.length > 0) {
            appState.messageHistory = message.messages;
            
            // 채널 메시지 처리
            if (message.channels) {
                Object.keys(message.channels).forEach(channelId => {
                    if (!appState.channels[channelId]) {
                        appState.channels[channelId] = {
                            name: message.channels[channelId].name,
                            messages: []
                        };
                    }
                    appState.channels[channelId].messages = 
                        message.channels[channelId].messages || [];
                });
                
                // 채널 목록 업데이트
                updateChannelsList();
            }
            
            // 히스토리 메시지 표시
            displayMessageHistory();
        }
    } catch (error) {
        console.error('메시지 히스토리 처리 중 오류:', error);
    }
}

/**
 * 메시지 히스토리 표시
 */
function displayMessageHistory() {
    try {
        if (!UI.chatMessages) return;
        
        // 채팅 메시지 영역 초기화
        UI.chatMessages.innerHTML = '';
        
        // 현재 채널의 메시지 가져오기
        let messages = [];
        if (appState.currentChannel && appState.channels[appState.currentChannel]) {
            messages = appState.channels[appState.currentChannel].messages;
        } else {
            messages = appState.messageHistory;
        }
        
        // 메시지 표시
        messages.forEach(message => {
            if (message.type === 'chat') {
                addChatMessage(message.userName, message.content, message.timestamp, message.messageId, message.userId);
            } else if (message.type === 'file' && message.action === 'file_info') {
                // 파일 메시지는 링크로만 표시 (실제 파일 데이터는 없음)
                addFileHistoryMessage(
                    message.userName, 
                    message.fileName, 
                    message.fileSize, 
                    message.timestamp,
                    message.messageId,
                    message.userId
                );
            } else if (message.type === 'system' && message.content) {
                addSystemMessage(message.content);
            }
        });
        
        // 스크롤을 맨 아래로
        scrollToBottom();
    } catch (error) {
        console.error('메시지 히스토리 표시 중 오류:', error);
    }
}

/**
 * 채널 메시지 처리
 * @param {Object} message - 채널 메시지
 */
function handleChannelMessage(message) {
    try {
        console.log('채널 메시지 수신:', message);
        
        switch (message.action) {
            case 'create':
                // 채널 생성
                if (!appState.channels[message.channelId]) {
                    appState.channels[message.channelId] = {
                        name: message.channelName,
                        messages: [],
                        type: message.channelType || 'text'
                    };
                    
                    // 채널 목록 업데이트
                    updateChannelsList();
                    
                    // 시스템 메시지 표시
                    addSystemMessage(t('new_channel_created', { name: message.channelName }));
                }
                break;
                
            case 'delete':
                // 채널 삭제
                if (appState.channels[message.channelId]) {
                    const channelName = appState.channels[message.channelId].name;
                    delete appState.channels[message.channelId];
                    
                    // 삭제된 채널이 현재 채널이면 일반 채널로 이동
                    if (appState.currentChannel === message.channelId) {
                        switchChannel('general');
                    }
                    
                    // 채널 목록 업데이트
                    updateChannelsList();
                    
                    // 시스템 메시지 표시
                    addSystemMessage(t('channel_deleted', { name: channelName }));
                }
                break;
                
            case 'create_voice':
                // 음성 채널 생성
                if (!appState.voiceChannels[message.channelId]) {
                    appState.voiceChannels[message.channelId] = {
                        name: message.channelName,
                        users: [],
                        type: 'voice'
                    };
                    
                    // 음성 채널 목록 업데이트
                    updateVoiceChannelsList();
                    
                    // 시스템 메시지 표시
                    addSystemMessage(t('new_voice_channel_created', { name: message.channelName }));
                }
                break;
                
            case 'delete_voice':
                // 음성 채널 삭제
                if (appState.voiceChannels[message.channelId]) {
                    const channelName = appState.voiceChannels[message.channelId].name;
                    
                    // 현재 참여 중인 채널이면 나가기
                    if (appState.currentVoiceChannel === message.channelId) {
                        leaveVoiceChannel();
                    }
                    
                    delete appState.voiceChannels[message.channelId];
                    
                    // 음성 채널 목록 업데이트
                    updateVoiceChannelsList();
                    
                    // 시스템 메시지 표시
                    addSystemMessage(t('voice_channel_deleted', { name: channelName }));
                }
                break;
                
            default:
                console.warn('알 수 없는 채널 액션:', message.action);
        }
    } catch (error) {
        console.error('채널 메시지 처리 중 오류:', error);
    }
}
function handlePingMessage(message, fromPeerId) {
    // 핑에 대한 응답 전송
    if (appState.connections[fromPeerId]) {
        sendData(appState.connections[fromPeerId], { 
            type: 'pong', 
            timestamp: message.timestamp,
            responseTime: Date.now() 
        });
    }
}


function handlePongMessage(message, fromPeerId) {
    // 지연시간 계산
    const latency = Date.now() - message.timestamp;
    
    // 연결 통계에 저장
    if (!appState.peerConnectionStats[fromPeerId]) {
        appState.peerConnectionStats[fromPeerId] = {};
    }
    
    appState.peerConnectionStats[fromPeerId].latency = latency;
    appState.peerConnectionStats[fromPeerId].lastPongTime = Date.now();
    
    // 연결 상태 로그 (디버깅용)
    if (latency > 1000) {
        console.warn(`피어 ${fromPeerId}와의 높은 지연시간 감지: ${latency}ms`);
    }
    
    // 타임아웃이 설정되어 있으면 취소
    if (appState.connections[fromPeerId] && 
        appState.connections[fromPeerId].pongTimeout) {
        clearTimeout(appState.connections[fromPeerId].pongTimeout);
        delete appState.connections[fromPeerId].pongTimeout;
    }
    
    // 누락된 핑 카운터 리셋
    if (appState.peerConnectionStats[fromPeerId]) {
        appState.peerConnectionStats[fromPeerId].missedPings = 0;
    }
}
/**
 * 관리자 메시지 처리
 * @param {Object} message - 관리자 메시지
 */
function handleAdminMessage(message) {
    try {
        console.log('관리자 메시지 수신:', message);
        
        switch (message.action) {
            case 'promote':
                // 관리자 승격
                if (message.targetId === appState.localUserId) {
                    appState.isAdmin = true;
                    showToast(t('admin_permission_granted'));
                    
                    // 시스템 메시지 표시
                    addSystemMessage(t('admin_permission_granted'));
                }
                
                // 대상 사용자 정보 업데이트
                if (appState.users[message.targetId]) {
                    appState.users[message.targetId].role = 'admin';
                    updateUsersList();
                    
                    // 다른 사용자인 경우 시스템 메시지 표시
                    if (message.targetId !== appState.localUserId) {
                        const userName = appState.users[message.targetId].name;
                        addSystemMessage(t('user_promoted_to_admin', { user: userName }));
                    }
                }
                break;
                
            case 'demote':
                // 관리자 강등
                if (message.targetId === appState.localUserId) {
                    appState.isAdmin = false;
                    showToast(t('admin_permission_removed'));
                    
                    // 시스템 메시지 표시
                    addSystemMessage(t('admin_permission_removed'));
                }
                
                // 대상 사용자 정보 업데이트
                if (appState.users[message.targetId]) {
                    appState.users[message.targetId].role = 'user';
                    updateUsersList();
                    
                    // 다른 사용자인 경우 시스템 메시지 표시
                    if (message.targetId !== appState.localUserId) {
                        const userName = appState.users[message.targetId].name;
                        addSystemMessage(t('admin_permission_removed_from_user', { user: userName }));
                    }
                }
                break;
                
            case 'kick':
                // 강퇴
                if (message.targetId === appState.localUserId) {
                    showToast(t('you_were_kicked'), 3000, 'error');
                    
                    // 경고음 재생
                    playNotificationSound('error');
                    
                    // 3초 후 페이지 리로드
                    setTimeout(() => {
                        window.location.hash = '';
                        window.location.reload();
                    }, 3000);
                } else if (appState.users[message.targetId]) {
                    // 다른 사용자가 강퇴된 경우
                    const userName = appState.users[message.targetId].name;
                    addSystemMessage(t('user_kicked', { user: userName }));
                }
                break;
                
            case 'ban':
                // 차단
                if (message.targetId === appState.localUserId) {
                    showToast(t('you_were_banned'), 3000, 'error');
                    
                    // 경고음 재생
                    playNotificationSound('error');
                    
                    // 로컬 스토리지에 차단 정보 저장
                    const bannedRooms = LocalStorage.load('bannedRooms', {});
                    bannedRooms[appState.roomId] = true;
                    LocalStorage.save('bannedRooms', bannedRooms);
                    
                    // 3초 후 페이지 리로드
                    setTimeout(() => {
                        window.location.hash = '';
                        window.location.reload();
                    }, 3000);
                } else if (appState.users[message.targetId]) {
                    // 다른 사용자가 차단된 경우
                    const userName = appState.users[message.targetId].name;
                    addSystemMessage(t('user_banned', { user: userName }));
                }
                break;
                
            case 'timeout':
                // 타임아웃
                if (message.targetId === appState.localUserId) {
                    // 채팅 비활성화
                    if (UI.messageInput) UI.messageInput.disabled = true;
                    if (UI.sendMessageBtn) UI.sendMessageBtn.disabled = true;
                    if (UI.fileInput) UI.fileInput.disabled = true;
                    
                    // 타임아웃 시간
                    const timeoutMinutes = message.duration || 5;
                    showToast(t('chat_restricted', { minutes: timeoutMinutes }), 5000, 'warning');
                    
                    // 시스템 메시지 표시
                    addSystemMessage(t('chat_restricted', { minutes: timeoutMinutes }));
                    
                    // 타임아웃 해제 타이머
                    setTimeout(() => {
                        if (UI.messageInput) UI.messageInput.disabled = false;
                        if (UI.sendMessageBtn) UI.sendMessageBtn.disabled = false;
                        if (UI.fileInput) UI.fileInput.disabled = false;
                        showToast(t('chat_restriction_lifted'));
                        addSystemMessage(t('chat_restriction_lifted'));
                    }, timeoutMinutes * 60 * 1000);
                } else if (appState.users[message.targetId]) {
                    // 다른 사용자가 타임아웃된 경우
                    const userName = appState.users[message.targetId].name;
                    const timeoutMinutes = message.duration || 5;
                    addSystemMessage(t('user_timed_out', { user: userName, minutes: timeoutMinutes }));
                }
                break;
                
            default:
                console.warn('알 수 없는 관리자 액션:', message.action);
        }
    } catch (error) {
        console.error('관리자 메시지 처리 중 오류:', error);
    }
}

/**
 * 채널 목록 업데이트
 */
function updateChannelsList() {
    try {
        const channelsList = UI.channelsList;
        if (!channelsList) return;
        
        // 기존 항목 제거
        channelsList.innerHTML = '';
        
        // 채널 목록 생성
        Object.entries(appState.channels).forEach(([channelId, channel]) => {
            const channelDiv = document.createElement('div');
            channelDiv.className = 'channel';
            channelDiv.dataset.channel = channelId;
            
            if (channelId === appState.currentChannel) {
                channelDiv.classList.add('active');
            }
            
            // 새 메시지 알림 표시 (현재 채널이 아닌 경우)
            const hasNewMessages = channelId !== appState.currentChannel && 
                channel.messages && 
                channel.messages.length > 0 &&
                channel.messages.some(msg => 
                    msg.timestamp > appState.lastReadTimestamps?.[channelId] || 0 &&
                    msg.userId !== appState.localUserId
                );
            
            if (hasNewMessages) {
                channelDiv.classList.add('has-new-messages');
            }
            
            channelDiv.innerHTML = `
                <div class="channel-content">
                    <span class="channel-name">${escapeHtml(channel.name)}</span>
                    ${hasNewMessages ? '<span class="new-messages-indicator"></span>' : ''}
                </div>
            `;
            
            // 채널 클릭 시 이벤트 처리
            channelDiv.addEventListener('click', () => {
                switchChannel(channelId);
            });
            
            channelsList.appendChild(channelDiv);
        });
    } catch (error) {
        console.error('채널 목록 업데이트 중 오류:', error);
    }
}

/**
 * 채널 전환
 * @param {string} channelId - 전환할 채널 ID
 */
function switchChannel(channelId) {
    try {
        // 기존 채널과 동일하면 무시
        if (channelId === appState.currentChannel) return;
        
        // 채널 유효성 확인
        if (!appState.channels[channelId]) {
            showToast(t('channel_not_found'));
            return;
        }
        
        // 마지막 읽은 시간 저장 (이전 채널)
        if (appState.currentChannel) {
            appState.lastReadTimestamps = appState.lastReadTimestamps || {};
            appState.lastReadTimestamps[appState.currentChannel] = Date.now();
        }
        
        // 현재 채널 변경
        appState.currentChannel = channelId;
        
        // 채널 목록 UI 업데이트
        updateChannelsList();
        
        // 채팅 메시지 영역 초기화 및 현재 채널 메시지 표시
        displayMessageHistory();
        
        // 채팅방 제목 업데이트
        if (UI.roomName) {
            UI.roomName.textContent = `${t('room', { room: appState.roomId })} - ${appState.channels[channelId].name}`;
        }
        
        // 타이핑 인디케이터 업데이트
        updateTypingIndicator();
    } catch (error) {
        console.error('채널 전환 중 오류:', error);
    }
}

/**
 * 새 채널 추가
 * @param {string} channelName - 채널 이름
 * @param {string} type - 채널 유형 (text, voice)
 * @return {boolean} 성공 여부
 */
function addChannel(channelName, type = 'text') {
    try {
        // 채널 이름 유효성 검사
        if (!channelName || channelName.trim().length === 0) {
            showToast(t('enter_channel_name'));
            return false;
        }
        
        // 중복 채널 이름 확인
        const channelExists = Object.values(type === 'text' ? appState.channels : appState.voiceChannels).some(
            channel => channel.name.toLowerCase() === channelName.toLowerCase()
        );
        
        if (channelExists) {
            showToast(t('channel_name_exists'));
            return false;
        }
        
        // 채널 ID 생성 (고유 ID)
        const channelId = type === 'text' ? 
            'channel_' + Date.now() : 
            'voice_' + Date.now();
        
        if (type === 'text') {
            // 텍스트 채널 추가
            appState.channels[channelId] = {
                name: channelName,
                messages: [],
                type: 'text'
            };
            
            // 채널 생성 메시지 브로드캐스트
            broadcastMessage({
                type: 'channel',
                action: 'create',
                channelId: channelId,
                channelName: channelName,
                channelType: 'text'
            });
            
            // 채널 목록 업데이트
            updateChannelsList();
            
            // 새 채널로 전환
            switchChannel(channelId);
        } else {
            // 음성 채널 추가
            appState.voiceChannels[channelId] = {
                name: channelName,
                users: [],
                type: 'voice'
            };
            
            // 채널 생성 메시지 브로드캐스트
            broadcastMessage({
                type: 'channel',
                action: 'create_voice',
                channelId: channelId,
                channelName: channelName
            });
            
            // 음성 채널 목록 업데이트
            updateVoiceChannelsList();
        }
        
        return true;
    } catch (error) {
        console.error('채널 추가 중 오류:', error);
        return false;
    }
}

/**
 * 채널 삭제
 * @param {string} channelId - 삭제할 채널 ID
 * @return {boolean} 성공 여부
 */
function deleteChannel(channelId) {
    try {
        // 유효성 검사
        if (!appState.channels[channelId]) {
            showToast(t('channel_not_found'));
            return false;
        }
        
        // 기본 채널은 삭제 불가
        if (channelId === 'general') {
            showToast(t('cannot_delete_general'));
            return false;
        }
        
        // 관리자 권한 확인
        if (!appState.isHost && !appState.isAdmin) {
            showToast(t('no_channel_permission'));
            return false;
        }
        
        // 채널 이름 저장
        const channelName = appState.channels[channelId].name;
        
        // 로컬 채널 삭제
        delete appState.channels[channelId];
        
        // 현재 채널이 삭제된 경우 일반 채널로 전환
        if (appState.currentChannel === channelId) {
            switchChannel('general');
        }
        
        // 채널 삭제 메시지 브로드캐스트
        broadcastMessage({
            type: 'channel',
            action: 'delete',
            channelId: channelId
        });
        
        // 채널 목록 업데이트
        updateChannelsList();
        
        // 시스템 메시지 표시
        addSystemMessage(t('channel_deleted', { name: channelName }));
        
        return true;
    } catch (error) {
        console.error('채널 삭제 중 오류:', error);
        return false;
    }
}

/**
 * 음성 채널 삭제
 * @param {string} channelId - 삭제할 음성 채널 ID
 * @return {boolean} 성공 여부
 */
function deleteVoiceChannel(channelId) {
    try {
        // 유효성 검사
        if (!appState.voiceChannels[channelId]) {
            showToast(t('voice_channel_not_found'));
            return false;
        }
        
        // 기본 채널은 삭제 불가
        if (channelId === 'voice-general') {
            showToast(t('cannot_delete_general_voice'));
            return false;
        }
        
        // 관리자 권한 확인
        if (!appState.isHost && !appState.isAdmin) {
            showToast(t('no_channel_permission'));
            return false;
        }
        
        // 채널 이름 저장
        const channelName = appState.voiceChannels[channelId].name;
        
        // 해당 채널의 모든 사용자에게 알림
        if (appState.voiceChannels[channelId].users && appState.voiceChannels[channelId].users.length > 0) {
            // 사용자들이 채널에서 나가도록 요청
            broadcastMessage({
                type: 'channel',
                action: 'voice_channel_closing',
                channelId: channelId,
                channelName: channelName
            });
            
            // 현재 참여 중인 채널이면 나가기
            if (appState.currentVoiceChannel === channelId) {
                leaveVoiceChannel();
            }
        }
        
        // 로컬 채널 삭제
        delete appState.voiceChannels[channelId];
        
        // 채널 삭제 메시지 브로드캐스트
        broadcastMessage({
            type: 'channel',
            action: 'delete_voice',
            channelId: channelId
        });
        
        // 음성 채널 목록 업데이트
        updateVoiceChannelsList();
        
        // 시스템 메시지 표시
        addSystemMessage(t('voice_channel_deleted', { name: channelName }));
        
        return true;
    } catch (error) {
        console.error('음성 채널 삭제 중 오류:', error);
        return false;
    }
}

/**
 * 채널 추가 프롬프트 표시
 * @param {string} type - 채널 유형 (text, voice)
 */
function showAddChannelPrompt(type = 'text') {
    try {
        const channelType = type === 'voice' ? t('voice_channel') : t('text_channel');
        const channelName = prompt(t('enter_channel_name_prompt', { type: channelType }));
        
        if (channelName && channelName.trim()) {
            addChannel(channelName.trim(), type);
        }
    } catch (error) {
        console.error('채널 추가 프롬프트 표시 중 오류:', error);
    }
}

/**
 * 패널 표시/숨김 토글
 * @param {string} panelId - 패널 ID
 */
function togglePanel(panelId) {
    try {
        const panel = document.getElementById(panelId);
        if (!panel) return;
        
        if (panel.classList.contains('hidden')) {
            panel.classList.remove('hidden');
        } else {
            panel.classList.add('hidden');
        }
    } catch (error) {
        console.error('패널 토글 중 오류:', error);
    }
}

/**
 * 사용자 목록 표시/숨김 토글
 */
function toggleUsersPanel() {
    togglePanel('usersPanel');
}

/**
 * 채널 목록 표시/숨김 토글
 */
function toggleChannelsPanel() {
    togglePanel('channelsPanel');
}

/**
 * 알림 권한 확인
 */
function checkNotificationPermission() {
    try {
        // 알림 API가 사용 가능한지 확인
        if (!('Notification' in window)) {
            console.log('이 브라우저는 알림을 지원하지 않습니다.');
            appState.notifications.permission = 'not-supported';
            return;
        }
        
        // 현재 알림 권한 상태 확인
        appState.notifications.permission = Notification.permission;
        
        // 알림 권한이 허용되지 않은 경우 UI 업데이트
        updateNotificationUI();
    } catch (error) {
        console.error('알림 권한 확인 중 오류:', error);
    }
}

/**
 * 알림 권한 요청
 * @return {Promise} 권한 요청 결과
 */
function requestNotificationPermission() {
    try {
        if (!('Notification' in window)) {
            showToast(t('notifications_not_supported'));
            return Promise.reject('notifications-not-supported');
        }
        
        return Notification.requestPermission()
            .then(permission => {
                appState.notifications.permission = permission;
                updateNotificationUI();
                
                if (permission === 'granted') {
                    showToast(t('notification_permission_granted'));
                    return true;
                } else {
                    showToast(t('notification_permission_denied'));
                    return false;
                }
            });
    } catch (error) {
        console.error('알림 권한 요청 중 오류:', error);
        return Promise.reject(error);
    }
}

/**
 * 알림 UI 업데이트
 */
function updateNotificationUI() {
    try {
        const permissionInfo = document.getElementById('notificationPermissionInfo');
        if (!permissionInfo) return;
        
        const notificationToggle = document.getElementById('notificationToggle');
        
        if (appState.notifications.permission === 'granted') {
            // 권한이 허용된 경우 정보 숨김
            permissionInfo.classList.add('hidden');
            
            // 토글 활성화
            if (notificationToggle) {
                notificationToggle.disabled = false;
            }
        } else {
            // 권한이 거부되거나 미정인 경우 정보 표시
            permissionInfo.classList.remove('hidden');
            
            // 토글 비활성화
            if (notificationToggle) {
                notificationToggle.disabled = true;
            }
        }
    } catch (error) {
        console.error('알림 UI 업데이트 중 오류:', error);
    }
}

/**
 * 데스크톱 알림 표시
 * @param {string} title - 알림 제목
 * @param {string} message - 알림 메시지
 */
function showDesktopNotification(title, message) {
    try {
        // 알림 설정 확인
        if (!appState.notifications.desktop) return;
        
        // 알림 권한 확인
        if (appState.notifications.permission !== 'granted') return;
        
        // 문서가 현재 포커스 상태인지 확인
        if (document.visibilityState === 'visible') return;
        
        // 알림 생성
        const notification = new Notification(`${APP_NAME} - ${title}`, {
            body: message,
            icon: 'favicon-modern.ico'
        });
        
        // 알림 클릭 시 창으로 포커스 이동
        notification.onclick = function() {
            window.focus();
            this.close();
        };
        
        // 일정 시간 후 알림 자동 닫기
        setTimeout(() => {
            notification.close();
        }, 5000);
    } catch (err) {
        console.error('알림 표시 중 오류:', err);
    }
}

/**
 * 알림 설정 저장
 */
function saveNotificationSettings() {
    try {
        const settings = {
            enabled: appState.notifications.enabled,
            desktop: appState.notifications.desktop,
            sound: appState.notifications.sound
        };
        
        LocalStorage.save('notificationSettings', settings);
    } catch (error) {
        console.error('알림 설정 저장 중 오류:', error);
    }
}

/**
 * 연결 상태 업데이트
 */
function updateConnectionStatusFromPeers() {
    try {
        const connections = Object.keys(appState.connections).length;
        
        if (connections === 0) {
            if (appState.isHost) {
                updateConnectionStatus(t('waiting_users', { count: 0 }), 'waiting');
            } else {
                updateConnectionStatus(t('connection_lost'), 'disconnected');
            }
        } else {
            updateConnectionStatus(t('connected_with_users', { count: connections }), 'connected');
        }
    } catch (error) {
        console.error('연결 상태 업데이트 중 오류:', error);
    }
}

/**
 * P2P 메시 네트워크 구축 (모든 피어끼리 연결)
 * @param {string} peerId - 연결할 피어 ID
 */
function connectToPeer(peerId) {
    try {
        // 이미 연결되어 있는 경우 건너뜀
        if (appState.connections[peerId] || peerId === appState.localUserId) {
            return;
        }
        
        console.log('피어에 직접 연결 시도:', peerId);
        
        const conn = appState.peer.connect(peerId, {
            reliable: true,
            serialization: 'json' // JSON 직렬화 사용
        });
        
        conn.on('open', () => {
            console.log('피어에 직접 연결됨:', peerId);
            
            // 연결 정보 저장
            appState.connections[peerId] = conn;
            
            // 데이터 리스너 설정
            conn.on('data', (data) => {
                handleReceivedMessage(data, peerId);
            });
            
            // 핑 프로세스 시작 (연결 유지)
            startPingProcess(conn);
            
            // 자신의 정보 전송
            sendData(conn, {
                type: 'system',
                action: 'user_info',
                userId: appState.localUserId,
                userName: appState.localUserName,
                userAvatar: appState.localUserAvatar,
                userStatus: appState.localUserStatus,
                isHost: appState.isHost, 
                isAdmin: appState.isAdmin
            });
            
            // 연결 상태 업데이트
            updateConnectionStatusFromPeers();
        });
        
        conn.on('close', () => {
            console.log('피어 직접 연결 종료:', peerId);
            
            // 핑 타이머 제거
            if (conn.pingInterval) {
                clearInterval(conn.pingInterval);
                delete conn.pingInterval;
            }
            
            // 호스트가 아니고, 연결이 호스트였던 경우에만 특별 처리
            if (!appState.isHost && peerId === appState.roomId) {
                handleHostDisconnect();
            } else {
                handlePeerDisconnect(peerId);
            }
        });
        
        conn.on('error', (err) => {
            console.error('피어 직접 연결 오류:', err);
            
            // 핑 타이머 제거
            if (conn.pingInterval) {
                clearInterval(conn.pingInterval);
                delete conn.pingInterval;
            }
        });
    } catch (err) {
        console.error('피어 직접 연결 시도 중 예외 발생:', err);
    }
}
/**
 * 호스트 연결 종료 감지 및 처리
 */
function handleHostDisconnect() {
    try {
        showToast(t('host_disconnected'), 5000, 'warning');
        
        // 새 호스트 선출 시도
        setTimeout(() => {
            electNewHost();
        }, 1000);
    } catch (error) {
        console.error('호스트 연결 종료 처리 중 오류:', error);
    }
}

/**
 * 사용자 목록 업데이트
 */
function updateUsersList() {
    try {
        if (!UI.usersList) return;
        
        UI.usersList.innerHTML = '';
        
        // 사용자 목록 생성 (역할별로 정렬: 호스트 > 관리자 > 일반 사용자)
        const sortedUsers = Object.entries(appState.users).sort((a, b) => {
            const roleA = a[1].role;
            const roleB = b[1].role;
            
            if (roleA === 'host' && roleB !== 'host') return -1;
            if (roleA !== 'host' && roleB === 'host') return 1;
            if (roleA === 'admin' && roleB !== 'admin') return -1;
            if (roleA !== 'admin' && roleB === 'admin') return 1;
            
            return a[1].name.localeCompare(b[1].name);
        });
        
        // 호스트, 관리자, 온라인, 자리비움, 방해금지 순으로 그룹 생성
        const groups = {
            'host': { title: t('hosts'), users: [] },
            'admin': { title: t('admins'), users: [] },
            'online': { title: t('online_users'), users: [] },
            'away': { title: t('away_users'), users: [] },
            'dnd': { title: t('dnd_users'), users: [] }
        };
        
        // 사용자를 그룹에 배치
        sortedUsers.forEach(([userId, user]) => {
            if (user.role === 'host') {
                groups.host.users.push([userId, user]);
            } else if (user.role === 'admin') {
                groups.admin.users.push([userId, user]);
            } else if (user.status === 'away') {
                groups.away.users.push([userId, user]);
            } else if (user.status === 'dnd') {
                groups.dnd.users.push([userId, user]);
            } else {
                groups.online.users.push([userId, user]);
            }
        });
        
        // 각 그룹 순회하며 UI 생성
        Object.entries(groups).forEach(([groupKey, group]) => {
            if (group.users.length === 0) return;
            
            // 그룹 헤더
            const groupHeader = document.createElement('div');
            groupHeader.className = 'users-group-header';
            groupHeader.textContent = `${group.title} (${group.users.length})`;
            UI.usersList.appendChild(groupHeader);
            
            // 그룹 내 사용자 순회
            group.users.forEach(([userId, user]) => {
                const userDiv = document.createElement('div');
                userDiv.className = 'user-item';
                userDiv.dataset.userId = userId;
                
                // 상태 클래스 추가
                const userStatus = user.status || 'online';
                userDiv.classList.add(`status-${userStatus}`);
                
                // 자신인지 확인
                const isMe = userId === appState.localUserId;
                
                // 아바타 배경 설정
                let avatarStyle = '';
                if (user.avatar) {
                    avatarStyle = `background-image: url(${escapeHtml(user.avatar)}); background-color: transparent;`;
                } else {
                    const userColor = getColorFromName(user.name);
                    avatarStyle = `background-color: ${userColor};`;
                }
                
                // 사용자 역할 배지
                let roleBadge = '';
                if (user.role === 'host') {
                    roleBadge = `<span class="user-role-badge host">${t('host')}</span>`;
                } else if (user.role === 'admin') {
                    roleBadge = `<span class="user-role-badge admin">${t('admin')}</span>`;
                }
                
                // 상태 아이콘
                let statusTitle = t('status_online');
                if (userStatus === 'away') statusTitle = t('status_away');
                if (userStatus === 'dnd') statusTitle = t('status_dnd');
                
                const statusIcon = `<span class="user-status-icon status-${userStatus}" title="${statusTitle}"></span>`;
                
                // 음성 채널 아이콘 (현재 음성 채널에 있는 경우)
                let voiceIcon = '';
                let voiceChannelId = null;
                Object.entries(appState.voiceChannels).forEach(([channelId, channel]) => {
                    if (channel.users && channel.users.includes(userId)) {
                        voiceChannelId = channelId;
                        voiceIcon = `<span class="user-voice-icon" title="${t('in_voice_channel', { channel: channel.name })}">🔊</span>`;
                    }
                });
                
                userDiv.innerHTML = `
                    <div class="user-item-avatar" style="${avatarStyle}"></div>
                    <div class="user-item-info">
                        <div class="user-item-name">${escapeHtml(user.name)}${isMe ? ` (${t('me')})` : ''}${roleBadge}</div>
                        <div class="user-item-icons">
                            ${statusIcon}
                            ${voiceIcon}
                        </div>
                    </div>
                `;
                
                // 관리자인 경우 사용자 클릭 이벤트 추가 (자신이 아닐 때만)
                if ((appState.isHost || appState.isAdmin) && !isMe) {
                    userDiv.style.cursor = 'pointer';
                    userDiv.addEventListener('click', () => {
                        showUserManageModal(userId);
                    });
                }
                
                // 음성 채널을 사용 중인 경우, 더블 클릭 시 동일 채널로 이동
                if (voiceChannelId && !isMe) {
                    userDiv.addEventListener('dblclick', () => {
                        if (appState.currentVoiceChannel !== voiceChannelId) {
                            joinVoiceChannel(voiceChannelId);
                        }
                    });
                }
                
                UI.usersList.appendChild(userDiv);
            });
        });
    } catch (error) {
        console.error('사용자 목록 업데이트 중 오류:', error);
    }
}

/**
 * 유틸리티 함수: 이름에서 색상 생성
 * @param {string} name - 사용자 이름
 * @return {string} 색상 코드
 */
function getColorFromName(name) {
    if (!name) return '#747F8D'; // 기본 색상
    
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    const colors = [
        '#5865F2', // 파랑
        '#3BA55C', // 초록
        '#ED4245', // 빨강
        '#FAA61A', // 노랑
        '#9B59B6', // 보라
        '#2EACB3', // 청록
        '#EB459E', // 분홍
        '#FF7143', // 주황
        '#43B581', // 민트
        '#747F8D'  // 회색
    ];
    
    return colors[Math.abs(hash) % colors.length];
}

/**
 * 유틸리티 함수: HTML 이스케이프
 * @param {string} unsafe - 원본 문자열
 * @return {string} 이스케이프된 문자열
 */
function escapeHtml(unsafe) {
    if (!unsafe) return '';
    
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/**
 * 유틸리티 함수: 파일 크기 포맷
 * @param {number} bytes - 바이트 단위 크기
 * @return {string} 포맷된 크기 문자열
 */
function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
    else return (bytes / 1073741824).toFixed(1) + ' GB';
}

/**
 * 유틸리티 함수: 클립보드에 복사
 * @param {string} text - 복사할 텍스트
 */
function copyToClipboard(text) {
    try {
        // navigator.clipboard API 사용 (HTTPS 필요)
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text).catch(e => {
                console.error('클립보드 복사 실패:', e);
                fallbackCopyToClipboard(text);
            });
            return;
        }
        
        // 폴백 메서드
        fallbackCopyToClipboard(text);
    } catch (error) {
        console.error('클립보드 복사 중 오류:', error);
        fallbackCopyToClipboard(text);
    }
}

/**
 * 폴백 클립보드 복사 메서드
 * @param {string} text - 복사할 텍스트
 */
function fallbackCopyToClipboard(text) {
    try {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        
        try {
            document.execCommand('copy');
        } catch (e) {
            console.error('클립보드 복사 실패:', e);
        }
        
        document.body.removeChild(textArea);
    } catch (error) {
        console.error('폴백 클립보드 복사 중 오류:', error);
    }
}

/**
 * 유틸리티 함수: 채팅창 스크롤 맨 아래로
 */
function scrollToBottom() {
    try {
        if (!UI.chatMessages) return;
        
        UI.chatMessages.scrollTop = UI.chatMessages.scrollHeight;
    } catch (error) {
        console.error('스크롤 조절 중 오류:', error);
    }
}

/**
 * 유틸리티 함수: 토스트 메시지 표시
 * @param {string} message - 메시지 내용
 * @param {number} duration - 표시 시간 (ms), 0은 무제한
 * @param {string} type - 메시지 타입 (info, success, warning, error)
 */
function showToast(message, duration = 3000, type = 'info') {
    try {
        // 기존 토스트 제거
        const existingToast = document.querySelector('.toast');
        if (existingToast) {
            document.body.removeChild(existingToast);
        }
        
        // 새 토스트 생성
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        
        // 스타일 추가
        toast.style.position = 'fixed';
        toast.style.bottom = '20px';
        toast.style.left = '50%';
        toast.style.transform = 'translateX(-50%)';
        toast.style.padding = '10px 20px';
        toast.style.borderRadius = '5px';
        toast.style.zIndex = '1000';
        toast.style.textAlign = 'center';
        toast.style.minWidth = '200px';
        toast.style.maxWidth = '80%';
        toast.style.boxShadow = '0 3px 10px rgba(0, 0, 0, 0.3)';
        
        // 토스트 타입에 따른 스타일
        switch (type) {
            case 'error':
                toast.style.backgroundColor = 'rgba(237, 66, 69, 0.9)';
                toast.style.color = 'white';
                break;
            case 'warning':
                toast.style.backgroundColor = 'rgba(250, 166, 26, 0.9)';
                toast.style.color = 'white';
                break;
            case 'success':
                toast.style.backgroundColor = 'rgba(59, 165, 92, 0.9)';
                toast.style.color = 'white';
                break;
            default: // info
                toast.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
                toast.style.color = 'white';
        }
        
        // 무제한 표시 시간인 경우 닫기 버튼 추가
        if (duration === 0) {
            const closeBtn = document.createElement('span');
            closeBtn.innerHTML = '&times;';
            closeBtn.style.marginLeft = '10px';
            closeBtn.style.cursor = 'pointer';
            closeBtn.style.fontWeight = 'bold';
            closeBtn.onclick = () => {
                if (document.body.contains(toast)) {
                    document.body.removeChild(toast);
                }
            };
            toast.appendChild(closeBtn);
        }
        
        // 애니메이션 효과
        if (duration > 0) {
            toast.style.animation = `fadeIn 0.3s, fadeOut 0.3s ${(duration / 1000 - 0.3)}s`;
        } else {
            toast.style.animation = 'fadeIn 0.3s';
        }
        
        // 문서에 추가
        document.body.appendChild(toast);
        // 일정 시간 후 제거 (무제한이 아닌 경우)
        if (duration > 0) {
            setTimeout(() => {
                if (document.body.contains(toast)) {
                    document.body.removeChild(toast);
                }
            }, duration);
        }
        
        // 애니메이션 키프레임 추가
        if (!document.getElementById('toastAnimations')) {
            const style = document.createElement('style');
            style.id = 'toastAnimations';
            style.textContent = `
                @keyframes fadeIn {
                    from { opacity: 0; transform: translate(-50%, 20px); }
                    to { opacity: 1; transform: translate(-50%, 0); }
                }
                @keyframes fadeOut {
                    from { opacity: 1; transform: translate(-50%, 0); }
                    to { opacity: 0; transform: translate(-50%, 20px); }
                }
            `;
            document.head.appendChild(style);
        }
    } catch (error) {
        console.error('토스트 메시지 표시 중 오류:', error);
        // 기본 알림창으로 대체
        alert(message);
    }
}

/**
 * 로컬 스토리지 유틸리티
 */
const LocalStorage = {
    /**
     * 로컬 스토리지에 데이터 저장
     * @param {string} key - 키
     * @param {*} data - 저장할 데이터
     * @return {boolean} 성공 여부
     */
    save: function(key, data) {
        try {
            // 문자열 데이터인지 확인
            if (typeof data === 'string') {
                localStorage.setItem(key, data);
            } else {
                localStorage.setItem(key, JSON.stringify(data));
            }
            return true;
        } catch (e) {
            console.error('로컬 스토리지 저장 오류:', e);
            return false;
        }
    },
    
    /**
     * 로컬 스토리지에서 데이터 불러오기
     * @param {string} key - 키
     * @param {*} defaultValue - 기본값
     * @return {*} 로드된 데이터
     */
    load: function(key, defaultValue = null) {
        try {
            const data = localStorage.getItem(key);
            if (data === null) return defaultValue;
            
            // JSON 파싱 시도
            try {
                return JSON.parse(data);
            } catch (e) {
                // JSON 파싱 실패하면 그대로 문자열 반환
                return data;
            }
        } catch (e) {
            console.error('로컬 스토리지 불러오기 오류:', e);
            return defaultValue;
        }
    },
    
    /**
     * 로컬 스토리지에서 데이터 삭제
     * @param {string} key - 키
     * @return {boolean} 성공 여부
     */
    remove: function(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (e) {
            console.error('로컬 스토리지 삭제 오류:', e);
            return false;
        }
    }
};

// 메시지 삭제 함수를 전역 스코프에 추가 (HTML에서 직접 호출용)
window.deleteMessage = deleteMessage;

// 앱 초기화 - DOM이 로드된 후 실행
document.addEventListener('DOMContentLoaded', initializeApp);
