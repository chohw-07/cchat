/**
 * cchat - 서버 없는 P2P 채팅 애플리케이션
 * PeerJS 라이브러리를 사용하여 브라우저 간 직접 통신
 * 
 * 주요 개선 사항:
 * 1. 버그 수정 (updateAvatarDisplay 함수 추가 등)
 * 2. 원격 통신 개선 (STUN/TURN 서버 추가)
 * 3. 메시지 삭제 기능 추가
 * 4. 채널 관리 UI 개선
 * 5. 사용자 상태 표시 기능
 */

// 상수 정의
const APP_NAME = 'cchat';
const DOMAIN = 'cchat.kro.kr';
const MAX_RETRY_COUNT = 5; // 재시도 횟수 증가
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
    // 공개 TURN 서버 (실제 운영 시에는 자체 TURN 서버 사용 권장)
    {
        urls: 'turn:numb.viagenie.ca',
        credential: 'muazkh',
        username: 'webrtc@live.com'
    }
];

// 애플리케이션 상태
const appState = {
    peer: null,                 // PeerJS 인스턴스
    connections: {},            // 연결된 피어들
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
        'general': { name: '일반', messages: [] }
    },
    currentChannel: 'general',  // 현재 채널
    notifications: {            // 알림 설정
        enabled: true,          // 알림 활성화 여부
        permission: null,       // 알림 권한 상태
        desktop: true,          // 데스크톱 알림 사용 여부
        sound: true             // 알림 소리 사용 여부
    },
    typing: {                   // 타이핑 상태
        users: {},              // 타이핑 중인 사용자
        timeout: null,          // 타이핑 타임아웃
        isTyping: false         // 현재 타이핑 중인지 여부 (추가)
    },
    peerConnectionStats: {},    // 피어 연결 상태 통계
    connectionEstablished: false // 연결 설정 완료 여부
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
    addChannelIcon: document.getElementById('addChannelIcon'),
    typingIndicator: document.getElementById('typingIndicator'),
    statusSelector: document.getElementById('statusSelector')
};

/**
 * 아바타 표시 업데이트
 * (이 함수를 saveProfile보다 먼저 정의하여 참조 오류 해결)
 */
function updateAvatarDisplay(avatarUrl) {
    if (!avatarUrl) return;
    
    // 메인 UI의 아바타 업데이트
    const userAvatar = document.getElementById('userAvatar');
    if (userAvatar) {
        userAvatar.style.backgroundImage = `url(${avatarUrl})`;
        userAvatar.style.backgroundColor = 'transparent';
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
 */
function updateAvatarElement(element, avatarUrl, userName) {
    if (avatarUrl) {
        element.style.backgroundImage = `url(${avatarUrl})`;
        element.style.backgroundColor = 'transparent';
    } else {
        element.style.backgroundImage = '';
        element.style.backgroundColor = getColorFromName(userName);
    }
}

/**
 * 애플리케이션 초기화
 */
function initializeApp() {
    console.log(`${APP_NAME} 애플리케이션 초기화 중...`);
    
    // 로컬 스토리지에서 사용자 설정 불러오기
    loadUserSettings();
    
    // URL에서 초대 코드 확인
    checkUrlForInviteCode();
    
    // 이벤트 리스너 설정
    setupEventListeners();
    
    // 알림 권한 확인
    checkNotificationPermission();
    
    // 디버그 정보 추가
    console.info(`${APP_NAME} 버전: 1.2.0`);
    console.info('WebRTC 지원: ', navigator.mediaDevices ? '지원됨' : '지원되지 않음');
    console.info('로컬 스토리지 지원: ', window.localStorage ? '지원됨' : '지원되지 않음');
}

/**
 * 사용자 설정 로드
 */
function loadUserSettings() {
    // 사용자 이름 불러오기
    const savedUserName = LocalStorage.load('userName');
    if (savedUserName) {
        appState.localUserName = savedUserName;
        UI.userName.textContent = savedUserName;
        UI.userNameModalInput.value = savedUserName;
    } else {
        // 기본 사용자 이름 설정
        appState.localUserName = '사용자' + Math.floor(Math.random() * 1000);
        UI.userName.textContent = appState.localUserName;
        UI.userNameModalInput.value = appState.localUserName;
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
                
                // 입력 필드에 초대 코드 채우기
                UI.joinCodeModalInput.value = inviteCode;
                
                // 약간의 지연 후 자동 참여
                setTimeout(() => {
                    const userName = UI.userNameModalInput.value.trim() || appState.localUserName;
                    saveUserName(userName);
                    joinRoom(inviteCode);
                }, 1000);
            } else {
                console.log('URL에 유효하지 않은 초대 코드:', inviteCode);
            }
        }
    } catch (error) {
        console.warn('URL에서 초대 코드 확인 중 오류:', error);
    }
}

/**
 * 이벤트 리스너 설정
 */
function setupEventListeners() {
    // 진입 모달 이벤트
    UI.createRoomModalBtn.addEventListener('click', () => {
        const userName = UI.userNameModalInput.value.trim() || appState.localUserName;
        saveUserName(userName);
        createRoom();
    });
    
    UI.joinRoomModalBtn.addEventListener('click', () => {
        const code = UI.joinCodeModalInput.value.trim();
        const userName = UI.userNameModalInput.value.trim() || appState.localUserName;
        
        if (code) {
            saveUserName(userName);
            joinRoom(code);
        } else {
            showToast('초대 코드를 입력해주세요.');
        }
    });
    
    // 모달 엔터키 처리
    UI.joinCodeModalInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            UI.joinRoomModalBtn.click();
        }
    });
    
    UI.userNameModalInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            // 초대 코드가 있으면 참여, 없으면 방 생성
            if (UI.joinCodeModalInput.value.trim()) {
                UI.joinRoomModalBtn.click();
            } else {
                UI.createRoomModalBtn.click();
            }
        }
    });
    
    // 초대 모달 관련
    UI.inviteBtn.addEventListener('click', showInviteModal);
    UI.closeInviteModal.addEventListener('click', () => {
        UI.inviteModal.classList.add('hidden');
    });
    
    UI.copyInviteBtn.addEventListener('click', () => {
        copyToClipboard(UI.inviteCode.textContent);
        showToast('초대 코드가 클립보드에 복사되었습니다.');
    });
    
    UI.copyLinkBtn.addEventListener('click', () => {
        copyToClipboard(UI.inviteLink.textContent);
        showToast('초대 링크가 클립보드에 복사되었습니다.');
    });
    
    // 연결 재시도 버튼
    UI.retryConnectionBtn.addEventListener('click', () => {
        UI.connectionError.classList.add('hidden');
        
        // 현재 상태에 따라 재시도
        if (appState.isHost) {
            createRoom();
        } else if (appState.roomId) {
            joinRoom(appState.roomId);
        }
    });
    
    // 사용자 메뉴 이벤트
    const userInfo = document.getElementById('userInfo');
    if (userInfo) {
        userInfo.addEventListener('click', showProfileModal);
    }
    
    // 프로필 모달 이벤트
    const closeProfileModal = document.getElementById('closeProfileModal');
    if (closeProfileModal) {
        closeProfileModal.addEventListener('click', () => {
            document.getElementById('profileModal').classList.add('hidden');
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
    const addChannelIcon = document.getElementById('addChannelIcon');
    if (addChannelIcon) {
        addChannelIcon.addEventListener('click', () => {
            if (appState.isHost || appState.isAdmin) {
                showAddChannelPrompt();
            } else {
                showToast('채널 추가 권한이 없습니다.');
            }
        });
    }
    
    // 관리자 모달 이벤트
    const closeAdminModal = document.getElementById('closeAdminModal');
    if (closeAdminModal) {
        closeAdminModal.addEventListener('click', () => {
            document.getElementById('adminModal').classList.add('hidden');
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
            if (e.key === 'Enter') {
                addChannelBtn.click();
            }
        });
    }
    
    // 사용자 관리 모달 이벤트
    const closeUserManageModal = document.getElementById('closeUserManageModal');
    if (closeUserManageModal) {
        closeUserManageModal.addEventListener('click', () => {
            document.getElementById('userManageModal').classList.add('hidden');
        });
    }
    
    // 사용자 관리 버튼 이벤트
    setupUserManagementButtons();
    
    // 채팅 관련
    UI.sendMessageBtn.addEventListener('click', sendChatMessage);
    
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
    
    // 파일 전송
    UI.fileInput.addEventListener('change', handleFileSelection);
    
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
        showToast('인터넷 연결이 복구되었습니다.');
        
        // 재연결 시도
        if (appState.connectionEstablished && appState.peer) {
            if (appState.peer.disconnected) {
                appState.peer.reconnect();
            }
        }
    });
    
    window.addEventListener('offline', () => {
        showToast('인터넷 연결이 끊겼습니다.', 0, 'error');
        updateConnectionStatus('연결 끊김', 'disconnected');
    });
}

/**
 * 사용자 관리 버튼 설정
 */
function setupUserManagementButtons() {
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
                
                document.getElementById('userManageModal').classList.add('hidden');
                showToast('관리자 권한을 부여했습니다.');
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
                
                document.getElementById('userManageModal').classList.add('hidden');
                showToast('관리자 권한을 제거했습니다.');
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
                
                document.getElementById('userManageModal').classList.add('hidden');
                showToast('사용자가 5분 동안 타임아웃 상태가 되었습니다.');
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
                
                document.getElementById('userManageModal').classList.add('hidden');
                showToast('사용자를
                강퇴했습니다.');
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
                
                document.getElementById('userManageModal').classList.add('hidden');
                showToast('사용자를 차단했습니다.');
            }
        });
    }
}

/**
 * 채널 컨텍스트 메뉴 설정
 */
function setupChannelContextMenu() {
    // 채널 목록에 우클릭 이벤트 추가
    UI.channelsList.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        
        // 클릭한 요소가 채널인지 확인
        const channelDiv = e.target.closest('.channel');
        if (!channelDiv) return;
        
        const channelId = channelDiv.dataset.channel;
        
        // 기본 채널은 삭제 불가
        if (channelId === 'general') {
            showToast('기본 채널은 삭제할 수 없습니다.');
            return;
        }
        
        // 관리자 권한 확인
        if (!appState.isHost && !appState.isAdmin) {
            showToast('채널 삭제 권한이 없습니다.');
            return;
        }
        
        // 확인 다이얼로그
        if (confirm(`"${appState.channels[channelId].name}" 채널을 삭제하시겠습니까?`)) {
            deleteChannel(channelId);
        }
    });
}

/**
 * 사용자 관리 모달 표시
 */
function showUserManageModal(userId) {
    // 사용자 정보 확인
    if (!appState.users[userId]) return;
    
    const user = appState.users[userId];
    const managedUserName = document.getElementById('managedUserName');
    const userManageInfo = document.getElementById('userManageInfo');
    
    // 관리자 권한 확인
    if (!appState.isHost && !appState.isAdmin) {
        showToast('사용자 관리 권한이 없습니다.');
        return;
    }
    
    // 사용자 정보 표시
    if (managedUserName) {
        managedUserName.textContent = `${user.name} 관리`;
    }
    
    // 사용자 역할 정보
    let roleInfo = '일반 사용자';
    if (user.role === 'host') {
        roleInfo = '방장';
    } else if (user.role === 'admin') {
        roleInfo = '관리자';
    }
    
    if (userManageInfo) {
        userManageInfo.innerHTML = `
            <p><strong>역할:</strong> ${roleInfo}</p>
            <p><strong>상태:</strong> ${getUserStatusText(user.status)}</p>
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
    document.getElementById('userManageModal').classList.remove('hidden');
}

/**
 * 사용자 상태 텍스트 반환
 */
function getUserStatusText(status) {
    switch (status) {
        case 'online': return '온라인';
        case 'away': return '자리 비움';
        case 'dnd': return '방해 금지';
        case 'offline': return '오프라인';
        default: return '온라인';
    }
}

/**
 * 사용자 상태 변경
 */
function changeUserStatus(status) {
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
}

/**
 * 상태 표시기 업데이트
 */
function updateStatusIndicator(userId, status) {
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
            
            let statusTitle = '온라인';
            if (status === 'away') statusTitle = '자리 비움';
            if (status === 'dnd') statusTitle = '방해 금지';
            
            statusIcon.title = statusTitle;
        }
    });
}

/**
 * 테마 전환
 */
function toggleTheme(e) {
    const isLightTheme = e.target.checked;
    
    if (isLightTheme) {
        document.body.classList.add('light-theme');
    } else {
        document.body.classList.remove('light-theme');
    }
    
    // 설정 저장
    LocalStorage.save('darkTheme', !isLightTheme);
}

/**
 * 타이핑 상태 전송
 */
function sendTypingStatus(isTyping) {
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
}

/**
 * 타이핑 인디케이터 업데이트
 */
function updateTypingIndicator() {
    // typingIndicator 요소가 없으면 생성
    if (!UI.typingIndicator) {
        UI.typingIndicator = document.createElement('div');
        UI.typingIndicator.className = 'typing-indicator hidden';
        UI.chatMessages.parentNode.insertBefore(UI.typingIndicator, UI.chatMessages.nextSibling);
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
        typingMessage = `${typingUsers[0]}님이 입력 중...`;
    } else if (typingUsers.length === 2) {
        typingMessage = `${typingUsers[0]}님과 ${typingUsers[1]}님이 입력 중...`;
    } else {
        typingMessage = `${typingUsers.length}명이 입력 중...`;
    }
    
    // UI 업데이트
    UI.typingIndicator.textContent = typingMessage;
    UI.typingIndicator.classList.remove('hidden');
}

/**
 * 프로필 모달 표시
 */
function showProfileModal() {
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
    
    // 테마 설정 표시
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.checked = document.body.classList.contains('light-theme');
    }
    
    // 알림 권한 UI 업데이트
    updateNotificationUI();
    
    // 모달 표시
    profileModal.classList.remove('hidden');
}

/**
 * 아바타 변경 처리
 */
function handleAvatarChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    // 파일 유형 검사
    if (!file.type.startsWith('image/')) {
        showToast('이미지 파일만 선택할 수 있습니다.');
        return;
    }
    
    // 파일 크기 제한 (1MB)
    if (file.size > 1024 * 1024) {
        showToast('이미지 크기는 1MB 이하여야 합니다.');
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
}

/**
 * 프로필 저장
 */
function saveProfile() {
    const profileNameInput = document.getElementById('profileNameInput');
    const notificationToggle = document.getElementById('notificationToggle');
    const soundToggle = document.getElementById('soundToggle');
    const statusSelector = document.getElementById('statusSelector');
    
    // 사용자 이름 변경
    if (profileNameInput && profileNameInput.value.trim()) {
        const newName = profileNameInput.value.trim();
        if (newName !== appState.localUserName) {
            // 이름 변경
            appState.localUserName = newName;
            document.getElementById('userName').textContent = newName;
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
    
    // 알림 설정 저장
    saveNotificationSettings();
    
    // 모달 닫기
    document.getElementById('profileModal').classList.add('hidden');
    
    showToast('프로필이 저장되었습니다.');
}

/**
 * 사용자 이름 저장
 */
function saveUserName(userName) {
    appState.localUserName = userName;
    UI.userName.textContent = userName;
    
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
}

/**
 * 간단한 방 ID 생성 (4자리)
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
    
    // 새 호스트 인스턴스 생성 (새로운 조합)
    appState.peer = new Peer(roomId, {
        debug: 1, // 디버그 레벨 낮춤
        config: {
            'iceServers': ICE_SERVERS
        }
    });
    
    // PeerJS 이벤트 리스너 설정
    setupPeerEvents();
    
    // UI 업데이트
    UI.roomName.textContent = `채팅방 #${roomId}`;
    
    // URL 업데이트
    updateUrlWithRoomId(roomId);
    
    // 네트워크 품질 모니터링 시작
    startNetworkMonitoring();
}

/**
 * 방 참여
 */
function joinRoom(roomId) {
    // 초대 코드 검증 (4자리 영숫자만 허용)
    if (!/^[a-z0-9]{4}$/i.test(roomId)) {
        handleConnectionError('유효하지 않은 초대 코드입니다. 4자리 코드를 입력해주세요.');
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
    
    // 새 사용자 인스턴스 생성 (단순화)
    appState.peer = new Peer(peerId, {
        debug: 1, // 디버그 레벨 낮춤
        config: {
            'iceServers': ICE_SERVERS
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
    UI.roomName.textContent = `채팅방 #${roomId}`;
    
    // URL 업데이트
    updateUrlWithRoomId(roomId);
    
    // 네트워크 품질 모니터링 시작
    startNetworkMonitoring();
}

/**
 * 호스트에 연결
 */
function connectToHost(hostId) {
    console.log('호스트에 연결 시도:', hostId);
    
    // 피어ID가 존재하는지 확인
    if (!appState.localUserId) {
        console.error('로컬 피어 ID가 설정되지 않았습니다.');
        handleConnectionError('연결 초기화 오류. 다시 시도해주세요.');
        return;
    }
    
    try {
        const conn = appState.peer.connect(hostId, {
            reliable: true,
            serialization: 'json' // JSON 직렬화 사용 (추가)
        });
        
        // 연결 시간 초과 처리
        const connectionTimeout = setTimeout(() => {
            if (!appState.connections[hostId]) {
                console.error('호스트 연결 시간 초과');
                handleConnectionError('호스트 연결 시간이 초과되었습니다. 초대 코드를 다시 확인해주세요.');
            }
        }, 20000); // 20초 타임아웃 (증가)
        
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
            handleConnectionError('호스트 연결 중 오류가 발생했습니다: ' + err.message);
        });
    } catch (err) {
        console.error('호스트 연결 시도 중 예외 발생:', err);
        handleConnectionError('연결 시도 중 오류가 발생했습니다: ' + err.message);
    }
}

/**
 * 네트워크 모니터링 시작
 */
function startNetworkMonitoring() {
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
            updateConnectionStatus('연결 끊김', 'disconnected');
            
            // 재연결 시도
            if (appState.peer && appState.peer.disconnected) {
                console.log('연결이 끊겼습니다. 재연결 시도...');
                appState.peer.reconnect();
            }
        }
        
        // 각 피어 연결 상태 확인
        Object.entries(appState.connections).forEach(([peerId, conn]) => {
            if (conn.peerConnection) {
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
            }
        });
    }, 5000); // 5초마다 확인
}

/**
 * PeerJS 이벤트 리스너 설정
 */
function setupPeerEvents() {
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
            addSystemMessage(`방이 생성되었습니다. 초대 코드: ${appState.roomId}`);
            addSystemMessage('다른 사용자를 초대하려면 상단의 [초대하기] 버튼을 클릭하세요.');
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
                        message: '이 방에서 차단되었습니다.'
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
                
                // 삭제된 메시지 목록 동기화
                if (Object.keys(appState.deletedMessages).length > 0) {
                    sendData(conn, {
                        type: 'system',
                        action: 'sync_deleted_messages',
                        deletedMessages: appState.deletedMessages
                    });
                }
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
        });
        
        conn.on('close', () => {
            console.log('피어 연결 종료:', conn.peer);
            handlePeerDisconnect(conn.peer);
        });
        
        conn.on('error', (err) => {
            console.error('피어 연결 오류:', err);
        });
    });
    
    appState.peer.on('error', (err) => {
        console.error('PeerJS 오류:', err);
        
        // 특정 오류 처리
        if (err.type === 'peer-unavailable') {
            handleConnectionError('해당 방이 존재하지 않거나 호스트가 오프라인 상태입니다.');
        } else if (err.type === 'network' || err.type === 'server-error') {
            handleConnectionError('네트워크 연결 오류가 발생했습니다. 인터넷 연결을 확인해주세요.');
        } else if (err.type === 'socket-error') {
            handleConnectionError('소켓 연결 오류. 브라우저 또는 네트워크 방화벽 설정을 확인해주세요.');
        } else {
            handleConnectionError(`연결 중 오류가 발생했습니다: ${err.message || err.type}`);
        }
    });
    
    appState.peer.on('disconnected', () => {
        console.log('PeerJS 서버와 연결 끊김');
        updateConnectionStatus('서버와 연결 끊김', 'disconnected');
        
        // 자동 재연결 시도
        setTimeout(() => {
            if (appState.peer && appState.connectionRetryCount < MAX_RETRY_COUNT) {
                appState.connectionRetryCount++;
                console.log(`재연결 시도 ${appState.connectionRetryCount}/${MAX_RETRY_COUNT}`);
                updateConnectionStatus(`재연결 시도 중 (${appState.connectionRetryCount}/${MAX_RETRY_COUNT})...`, 'waiting');
                appState.peer.reconnect();
            } else {
                handleConnectionError('서버와 연결할 수 없습니다. 다시 시도해주세요.');
            }
        }, 1000);
    });
    
    appState.peer.on('close', () => {
        console.log('PeerJS 연결 닫힘');
        updateConnectionStatus('연결 종료됨', 'disconnected');
        appState.connectionEstablished = false;
    });
}

/**
 * 연결 모달 표시
 */
function showConnectionModal() {
    UI.connectionModal.classList.remove('hidden');
    UI.entryModal.classList.add('hidden');
    UI.connectionError.classList.add('hidden');
    
    // 모든 단계 초기화
    [UI.connectionStep1, UI.connectionStep2, UI.connectionStep3].forEach(step => {
        step.classList.remove('active', 'complete', 'error');
    });
    
    // 로더 초기화
    document.querySelectorAll('.loader').forEach(loader => {
        loader.style.width = '0%';
    });
    
    // 재시도 횟수 초기화
    appState.connectionRetryCount = 0;
}

/**
 * 연결 단계 업데이트
 */
function updateConnectionStep(stepNumber, status) {
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
}

/**
 * 연결 오류 처리
 */
function handleConnectionError(message) {
    console.error('연결 오류:', message);
    
    // 현재 활성화된 단계를 오류 상태로 변경
    for (let i = 1; i <= 3; i++) {
        const step = document.getElementById(`step${i}`);
        if (step && step.classList.contains('active')) {
            step.classList.remove('active');
            step.classList.add('error');
        }
    }
    
    // 오류 메시지 표시
    UI.connectionError.classList.remove('hidden');
    const errorMessageElement = document.querySelector('.error-message');
    if (errorMessageElement) {
        errorMessageElement.textContent = message;
    }
    
    // 연결 상태 업데이트
    updateConnectionStatus('연결 실패', 'disconnected');
    
    // 오류 알림 표시
    showToast(message, 5000, 'error');
}

/**
 * 연결 성공 처리
 */
function onConnectionSuccess() {
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
        UI.connectionModal.classList.add('hidden');
        updateConnectionStatus(appState.isHost ? '대기 중 (0명)' : '연결됨', 
                              appState.isHost ? 'waiting' : 'connected');
        updateUsersList();
    }, 1000);
    
    // 호스트가 아닐 경우만 환영 메시지
    if (!appState.isHost) {
        addSystemMessage(`채팅방 #${appState.roomId}에 입장했습니다.`);
    }
    
    // 성공 알림음 재생
    playNotificationSound('connect');
}

/**
 * 연결 상태 업데이트
 */
function updateConnectionStatus(text, status) {
    UI.connectionStatus.textContent = text;
    
    // 클래스 초기화
    UI.connectionStatus.classList.remove('connected', 'disconnected', 'waiting');
    
    // 상태에 따른 클래스 추가
    if (status) {
        UI.connectionStatus.classList.add(status);
    }
}

/**
 * 알림음 재생
 */
function playNotificationSound(type) {
    // 소리 재생 기능 비활성화 (버그 해결을 위해)
    // 실제 구현 시 간단한 비프음 사용
    console.log('알림 소리 재생:', type);
    
    // 이후 소리 기능 구현 시 주석 해제
    // const audio = new Audio();
    // audio.volume = 0.5;
    // audio.src = './sounds/' + type + '.mp3';
    // audio.play().catch(e => console.warn('알림 소리 재생 실패:', e));
}

/**
 * 수신된 메시지 처리
 */
function handleReceivedMessage(message, fromPeerId) {
    console.log('메시지 수신:', message);
    
    // 호스트인 경우, 다른 모든 피어에게 메시지 중계
    if (appState.isHost && message.type !== 'system') {
        // 메시지 중계: 발신자를 제외한 모든 피어에게 전달
        relayMessageToAllPeers(message, fromPeerId);
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
                    document.title = `(새 메시지) cchat - 채팅방 #${appState.roomId || ''}`;
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
                    showDesktopNotification(message.userName, `파일 공유: ${message.fileName}`);
                    
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
            
        default:
            console.warn('알 수 없는 메시지 유형:', message.type);
    }
}

/**
 * 메시지 삭제 처리
 */
function handleDeleteMessage(message) {
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
                messageText.innerHTML = '<em class="deleted-message">삭제된 메시지</em>';
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
}

/**
 * 히스토리에서 메시지 삭제 표시
 */
function markMessageAsDeleted(messageId, channelId) {
    // 특정 채널 메시지인 경우
    if (channelId && appState.channels[channelId]) {
        const messages = appState.channels[channelId].messages;
        const messageIndex = messages.findIndex(msg => msg.messageId === messageId);
        
        if (messageIndex !== -1) {
            if (messages[messageIndex].type === 'chat') {
                messages[messageIndex].deleted = true;
                messages[messageIndex].content = '[삭제된 메시지]';
            }
        }
    } else {
        // 일반 메시지
        const messageIndex = appState.messageHistory.findIndex(msg => msg.messageId === messageId);
        
        if (messageIndex !== -1) {
            if (appState.messageHistory[messageIndex].type === 'chat') {
                appState.messageHistory[messageIndex].deleted = true;
                appState.messageHistory[messageIndex].content = '[삭제된 메시지]';
            }
        }
    }
}

/**
 * 호스트가 메시지를 다른 모든 피어에게 중계
 */
function relayMessageToAllPeers(message, senderPeerId) {
    if (!appState.isHost) return; // 호스트만 중계 가능
    
    Object.entries(appState.connections).forEach(([peerId, conn]) => {
        // 발신자에게는 다시 보내지 않음
        if (peerId !== senderPeerId) {
            sendData(conn, message);
        }
    });
}

/**
 * 시스템 메시지 처리
 */
function handleSystemMessage(message, fromPeerId) {
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
                addSystemMessage(`${message.userName}님이 입장했습니다.`);
                
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
                            messageText.innerHTML = '<em class="deleted-message">삭제된 메시지</em>';
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
}

/**
 * 호스트 변경 처리
 */
function handleHostChange(message) {
    // 기존 호스트 확인
    const oldHostId = appState.roomId;
    const oldHostName = appState.users[oldHostId]?.name || '이전 방장';
    
    // 새 호스트 정보 업데이트
    const newHostId = message.newHostId;
    appState.roomId = newHostId;
    
    // 자신이 새 호스트가 되었는지 확인
    if (newHostId === appState.localUserId) {
        appState.isHost = true;
        appState.isAdmin = true;
        showToast('방장 권한이 당신에게 위임되었습니다.');
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
    const newHostName = appState.users[newHostId]?.name || '새 방장';
    addSystemMessage(`${oldHostName}님에서 ${newHostName}님으로 방장이 변경되었습니다.`);
    
    // URL 주소 업데이트
    updateUrlWithRoomId(newHostId);
}

/**
 * 새 호스트 선출
 */
function electNewHost() {
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
}

/**
 * 새 호스트가 되는 과정
 */
function becomeNewHost() {
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
    addSystemMessage('이전 방장이 나갔습니다. 당신이 새로운 방장이 되었습니다.');
    showToast('당신이 새로운 방장이 되었습니다.');
    
    // URL 주소 업데이트
    updateUrlWithRoomId(appState.localUserId);
}

/**
 * 피어 연결 종료 처리
 */
function handlePeerDisconnect(peerId) {
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
        
        // 호스트가 아닌 경우, 호스트와의 연결 종료 감지
        if (!appState.isHost && peerId === appState.roomId) {
            // 호스트가 나갔을 때 새 호스트 선출 시도
            electNewHost();
        } else {
            // 일반 사용자가 나간 경우 메시지 표시
            let message = `${userName}님이 퇴장했습니다.`;
            if (userRole === 'host') {
                message += ' (방장)';
            } else if (userRole === 'admin') {
                message += ' (관리자)';
            }
            addSystemMessage(message);
        }
    }
    
    // 연결 객체에서 제거
    if (appState.connections[peerId]) {
        delete appState.connections[peerId];
    }
    
    // 연결 상태 업데이트
    updateConnectionStatusFromPeers();
}

/**
 * 메시지 히스토리 전송
 */
function sendMessageHistory(targetUserId) {
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
}

/**
 * 파일 메시지 처리
 */
function handleFileMessage(message, fromPeerId) {
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
            
            // 파일 전송 시작 메시지 표시
            addFileTransferMessage(
                message.userName, 
                message.fileName, 
                message.fileSize, 
                message.fileId, 
                0,
                message.messageId,
                message.userId
            );
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
                    
                    // 파일 다운로드 링크 업데이트
                    updateFileDownloadLink(message.fileId, fileUrl, fileInfo.fileName);
                    
                    // 이미지인 경우 미리보기 추가
                    if (fileInfo.fileType.startsWith('image/')) {
                        addImagePreview(message.fileId, fileUrl);
                    }
                    
                    // 청크 데이터 정리 (메모리 누수 방지)
                    delete appState.fileChunks[message.fileId].chunks;
                }
            }
            break;
            
        default:
            console.warn('알 수 없는 파일 메시지 액션:', message.action);
    }
}

/**
 * 메시지 ID 생성
 */
function generateMessageId() {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 채팅 메시지 전송
 */
function sendChatMessage() {
    const messageText = UI.messageInput.value.trim();
    if (!messageText) return;
    
    // 타임아웃 상태 확인
    if (UI.messageInput.disabled) {
        showToast('현재 채팅이 제한되어 있습니다.');
        return;
    }
    
    // 연결이 없는 경우 처리
    if (!appState.connectionEstablished) {
        showToast('연결이 설정되지 않았습니다. 메시지를 전송할 수 없습니다.');
        return;
    }
    
    if (Object.keys(appState.connections).length === 0 && !appState.isHost) {
        showToast('현재 연결된 사용자가 없습니다. 메시지를 전송할 수 없습니다.');
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
        showToast('메시지 전송에 실패했습니다. 연결 상태를 확인해주세요.');
    }
}

/**
 * 메시지 삭제 요청
 */
function deleteMessage(messageId, channelId) {
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
        showToast('메시지 삭제 권한이 없습니다.');
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
}

/**
 * 파일 선택 처리
 */
function handleFileSelection(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    console.log('파일 선택됨:', file.name, file.type, file.size);
    
    // 파일 크기 제한 (예: 30MB)
    const MAX_FILE_SIZE = 30 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
        showToast('파일 크기는 30MB를 초과할 수 없습니다.');
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
    
    // 파일 전송 시작 메시지 표시
    addFileTransferMessage(
        appState.localUserName, 
        file.name, 
        file.size, 
        fileId, 
        0,
        messageId,
        appState.localUserId
    );
    
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
                
                // 파일 URL 생성 및 다운로드 링크 업데이트
                const fileUrl = URL.createObjectURL(file);
                updateFileDownloadLink(fileId, fileUrl, file.name);
                
                // 이미지인 경우 미리보기 추가
                if (file.type.startsWith('image/')) {
                    addImagePreview(fileId, fileUrl);
                }
            }
        };
        
        reader.readAsArrayBuffer(chunk);
    };
    
    // 첫 번째 청크 읽기 시작
    readNextChunk();
    
    // 파일 입력 필드 초기화
    UI.fileInput.value = '';
}

/**
 * 모든 연결에 메시지 브로드캐스트
 */
function broadcastMessage(message) {
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
            showToast('서버와 연결이 끊겼습니다. 재연결 중...', 0, 'warning');
            
            // 자동 재연결 시도
            if (appState.peer && appState.peer.disconnected) {
                appState.peer.reconnect();
            }
        }
    }
}

/**
 * 데이터 전송
 */
function sendData(connection, data) {
    try {
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
    // 방 ID가 없으면 모달을 표시하지 않음
    if (!appState.roomId) return;
    
    // 초대 코드 설정
    UI.inviteCode.textContent = appState.roomId;
    
    // 초대 링크 설정
    let inviteLink;
    if (window.location.protocol === 'file:') {
        // 로컬 파일 실행 시 도메인 부분은 고정 값 사용
        inviteLink = `${DOMAIN}/#${appState.roomId}`;
    } else {
        inviteLink = `${window.location.origin}/#${appState.roomId}`;
    }
    UI.inviteLink.textContent = inviteLink;
    
    // QR 코드 생성
    generateQRCode(inviteLink);
    
    // 모달 표시
    UI.inviteModal.classList.remove('hidden');
}

/**
 * QR 코드 생성
 */
function generateQRCode(data) {
    UI.qrContainer.innerHTML = '';
    
    try {
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
        UI.qrContainer.innerHTML = '<p>QR 코드 생성 실패</p>';
    }
}

/**
 * URL 경로 업데이트
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
    updateTypingIndicator();
}

/**
 * 채팅 메시지 추가
 */
function addChatMessage(userName, text, timestamp, messageId, userId) {
    // 삭제된 메시지인지 확인
    if (messageId && appState.deletedMessages[messageId]) {
        text = '[삭제된 메시지]';
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
        avatarStyle = `background-image: url(${appState.users[userId].avatar}); background-color: transparent;`;
    } else {
        avatarStyle = `background-color: ${userColor};`;
    }
    
    // 사용자 역할 배지
    let userBadge = '';
    if (userId && appState.users[userId]) {
        if (appState.users[userId].role === 'host') {
            userBadge = '<span class="user-role-badge host">방장</span>';
        } else if (appState.users[userId].role === 'admin') {
            userBadge = '<span class="user-role-badge admin">관리자</span>';
        }
    }
    
    // 삭제 버튼 (자신의 메시지 또는 관리자/호스트인 경우)
    let deleteButton = '';
    if (messageId && (isMe || appState.isAdmin || appState.isHost) && !appState.deletedMessages[messageId]) {
        deleteButton = `<button class="message-delete-btn" onclick="deleteMessage('${messageId}', '${appState.currentChannel}')">삭제</button>`;
    }
    
    messageDiv.innerHTML = `
        <div class="message-avatar" style="${avatarStyle}"></div>
        <div class="message-content">
            <div class="message-header">
                <span class="message-author" style="color: ${userColor}">${userName}${isMe ? ' (나)' : ''}${userBadge}</span>
                <span class="message-time">${timeString}</span>
                ${deleteButton}
            </div>
            <div class="message-text">${appState.deletedMessages[messageId] ? '<em class="deleted-message">삭제된 메시지</em>' : escapeHtml(text)}</div>
        </div>
    `;
    
    // 현재 채널이 메시지의 채널과 일치하는 경우에만 표시
    if (appState.currentChannel === (messageDiv.dataset.channel || 'general')) {
        UI.chatMessages.appendChild(messageDiv);
        scrollToBottom();
    }
}

/**
 * 시스템 메시지 추가
 */
function addSystemMessage(text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'system-message';
    messageDiv.textContent = text;
    
    UI.chatMessages.appendChild(messageDiv);
    scrollToBottom();
}

/**
 * 파일 전송 메시지 추가
 */
function addFileTransferMessage(userName, fileName, fileSize, fileId, progress, messageId, userId) {
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
        avatarStyle = `background-image: url(${appState.users[userId].avatar}); background-color: transparent;`;
    } else {
        avatarStyle = `background-color: ${userColor};`;
    }
    
    // 사용자 역할 배지
    let userBadge = '';
    if (userId && appState.users[userId]) {
        if (appState.users[userId].role === 'host') {
            userBadge = '<span class="user-role-badge host">방장</span>';
        } else if (appState.users[userId].role === 'admin') {
            userBadge = '<span class="user-role-badge admin">관리자</span>';
        }
    }
    
    // 삭제 버튼 (자신의 메시지 또는 관리자/호스트인 경우)
    let deleteButton = '';
    if (messageId && (isMe || appState.isAdmin || appState.isHost) && !appState.deletedMessages[messageId]) {
        deleteButton = `<button class="message-delete-btn" onclick="deleteMessage('${messageId}', '${appState.currentChannel}')">삭제</button>`;
    }
    
    messageDiv.innerHTML = `
        <div class="message-avatar" style="${avatarStyle}"></div>
        <div class="message-content">
            <div class="message-header">
                <span class="message-author" style="color: ${userColor}">${userName}${isMe ? ' (나)' : ''}${userBadge}</span>
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
                <button class="file-download" id="download-${fileId}" disabled>다운로드</button>
            </div>
            <div id="preview-${fileId}" class="file-preview"></div>
        </div>
    `;
    
    UI.chatMessages.appendChild(messageDiv);
    scrollToBottom();
}

/**
 * 파일 전송 진행 상태 업데이트
 */
function updateFileTransferProgress(fileId, progress) {
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
}

/**
 * 파일 다운로드 링크 업데이트
 */
function updateFileDownloadLink(fileId, fileUrl, fileName) {
    const downloadBtn = document.getElementById(`download-${fileId}`);
    if (!downloadBtn) return;
    
    downloadBtn.disabled = false;
    downloadBtn.onclick = () => {
        const a = document.createElement('a');
        a.href = fileUrl;
        a.download = fileName;
        a.click();
    };
}

/**
 * 이미지 미리보기 추가
 */
function addImagePreview(fileId, imageUrl) {
    const previewDiv = document.getElementById(`preview-${fileId}`);
    if (!previewDiv) return;
    
    const img = document.createElement('img');
    img.src = imageUrl;
    img.className = 'image-preview';
    img.onclick = () => window.open(imageUrl, '_blank');
    
    previewDiv.appendChild(img);
    scrollToBottom();
}

/**
 * 사용자 목록 업데이트
 */
function updateUsersList() {
    UI.usersList.innerHTML = '';
    
    // 사용자 목록 생성
    Object.entries(appState.users).forEach(([userId, user]) => {
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
            avatarStyle = `background-image: url(${user.avatar}); background-color: transparent;`;
        } else {
            const userColor = getColorFromName(user.name);
            avatarStyle = `background-color: ${userColor};`;
        }
        
        // 사용자 역할 배지
        let roleBadge = '';
        if (user.role === 'host') {
            roleBadge = '<span class="user-role-badge host">방장</span>';
        } else if (user.role === 'admin') {
            roleBadge = '<span class="user-role-badge admin">관리자</span>';
        }
        
        // 상태 아이콘
        let statusTitle = '온라인';
        if (userStatus === 'away') statusTitle = '자리 비움';
        if (userStatus === 'dnd') statusTitle = '방해 금지';
        
        const statusIcon = `<span class="user-status-icon status-${userStatus}" title="${statusTitle}"></span>`;
        
        userDiv.innerHTML = `
            <div class="user-item-avatar" style="${avatarStyle}"></div>
            <div class="user-item-info">
                <div class="user-item-name">${user.name}${isMe ? ' (나)' : ''}${roleBadge}</div>
                ${statusIcon}
            </div>
        `;
        
        // 관리자인 경우 사용자 클릭 이벤트 추가
        if ((appState.isHost || appState.isAdmin) && !isMe) {
            userDiv.style.cursor = 'pointer';
            userDiv.addEventListener('click', () => {
                showUserManageModal(userId);
            });
        }
        
        UI.usersList.appendChild(userDiv);
    });
    
    // 연결 상태 UI 업데이트
    updateConnectionStatusFromPeers();
}

/**
 * 메시지 히스토리 처리
 */
function handleHistoryMessage(message) {
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
}

/**
 * 메시지 히스토리 표시
 */
function displayMessageHistory() {
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
}

/**
 * 파일 히스토리 메시지 추가 (링크없는 버전)
 */
function addFileHistoryMessage(userName, fileName, fileSize, timestamp, messageId, userId) {
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
        avatarStyle = `background-image: url(${appState.users[userId].avatar}); background-color: transparent;`;
    } else {
        avatarStyle = `background-color: ${userColor};`;
    }
    
    // 사용자 역할 배지
    let userBadge = '';
    if (userId && appState.users[userId]) {
        if (appState.users[userId].role === 'host') {
            userBadge = '<span class="user-role-badge host">방장</span>';
        } else if (appState.users[userId].role === 'admin') {
            userBadge = '<span class="user-role-badge admin">관리자</span>';
        }
    }
    
    // 삭제 버튼 (자신의 메시지 또는 관리자/호스트인 경우)
    let deleteButton = '';
    if (messageId && (isMe || appState.isAdmin || appState.isHost) && !appState.deletedMessages[messageId]) {
        deleteButton = `<button class="message-delete-btn" onclick="deleteMessage('${messageId}', '${appState.currentChannel}')">삭제</button>`;
    }
    
    messageDiv.innerHTML = `
        <div class="message-avatar" style="${avatarStyle}"></div>
        <div class="message-content">
            <div class="message-header">
                <span class="message-author" style="color: ${userColor}">${userName}${isMe ? ' (나)' : ''}${userBadge}</span>
                <span class="message-time">${timeString}</span>
                ${deleteButton}
            </div>
            <div class="file-message">
                <div class="file-icon">📎</div>
                <div class="file-info">
                    <div class="file-name">${escapeHtml(fileName)}</div>
                    <div class="file-size">${formattedSize}</div>
                    <div class="file-history-note">이전에 공유된 파일입니다.</div>
                </div>
            </div>
        </div>
    `;
    
    UI.chatMessages.appendChild(messageDiv);
}

/**
 * 채널 메시지 처리
 */
function handleChannelMessage(message) {
    console.log('채널 메시지 수신:', message);
    
    switch (message.action) {
        case 'create':
            // 채널 생성
            if (!appState.channels[message.channelId]) {
                appState.channels[message.channelId] = {
                    name: message.channelName,
                    messages: []
                };
                
                // 채널 목록 업데이트
                updateChannelsList();
                
                // 시스템 메시지 표시
                addSystemMessage(`새 채널 "${message.channelName}"이(가) 생성되었습니다.`);
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
                addSystemMessage(`채널 "${channelName}"이(가) 삭제되었습니다.`);
            }
            break;
            
        default:
            console.warn('알 수 없는 채널 액션:', message.action);
    }
}

/**
 * 관리자 메시지 처리
 */
function handleAdminMessage(message) {
    console.log('관리자 메시지 수신:', message);
    
    switch (message.action) {
        case 'promote':
            // 관리자 승격
            if (message.targetId === appState.localUserId) {
                appState.isAdmin = true;
                showToast('관리자 권한이 부여되었습니다.');
                
                // 시스템 메시지 표시
                addSystemMessage('관리자 권한이 부여되었습니다');
            }
            
            // 대상 사용자 정보 업데이트
            if (appState.users[message.targetId]) {
                appState.users[message.targetId].role = 'admin';
                updateUsersList();
                
                // 다른 사용자인 경우 시스템 메시지 표시
                if (message.targetId !== appState.localUserId) {
                    const userName = appState.users[message.targetId].name;
                    addSystemMessage(`${userName}님이 관리자가 되었습니다`);
                }
            }
            break;
            
        case 'demote':
            // 관리자 강등
            if (message.targetId === appState.localUserId) {
                appState.isAdmin = false;
                showToast('관리자 권한이 제거되었습니다.');
                
                // 시스템 메시지 표시
                addSystemMessage('관리자 권한이 제거되었습니다');
            }
            
            // 대상 사용자 정보 업데이트
            if (appState.users[message.targetId]) {
                appState.users[message.targetId].role = 'user';
                updateUsersList();
                
                // 다른 사용자인 경우 시스템 메시지 표시
                if (message.targetId !== appState.localUserId) {
                    const userName = appState.users[message.targetId].name;
                    addSystemMessage(`${userName}님의 관리자 권한이 제거되었습니다`);
                }
            }
            break;
            
        case 'kick':
            // 강퇴
            if (message.targetId === appState.localUserId) {
                showToast('강퇴되었습니다. 메인 화면으로 이동합니다.', 3000, 'error');
                
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
                addSystemMessage(`${userName}님이 방에서 강퇴되었습니다.`);
            }
            break;
            
        case 'ban':
            // 차단
            if (message.targetId === appState.localUserId) {
                showToast('차단되었습니다. 메인 화면으로 이동합니다.', 3000, 'error');
                
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
                addSystemMessage(`${userName}님이 방에서 차단되었습니다`);
            }
            break;
            
        case 'timeout':
            // 타임아웃
            if (message.targetId === appState.localUserId) {
                // 채팅 비활성화
                UI.messageInput.disabled = true;
                UI.sendMessageBtn.disabled = true;
                UI.fileInput.disabled = true;
                
                // 타임아웃 시간
                const timeoutMinutes = message.duration || 5;
                showToast(`${timeoutMinutes}분 동안 채팅이 제한됩니다.`, 5000, 'warning');
                
                // 시스템 메시지 표시
                addSystemMessage(`${timeoutMinutes}분 동안 채팅이 제한됩니다.`);
                
                // 타임아웃 해제 타이머
                setTimeout(() => {
                    UI.messageInput.disabled = false;
                    UI.sendMessageBtn.disabled = false;
                    UI.fileInput.disabled = false;
                    showToast('채팅 제한이 해제되었습니다.');
                    addSystemMessage('채팅 제한이 해제되었습니다.');
                }, timeoutMinutes * 60 * 1000);
            } else if (appState.users[message.targetId]) {
                // 다른 사용자가 타임아웃된 경우
                const userName = appState.users[message.targetId].name;
                const timeoutMinutes = message.duration || 5;
                addSystemMessage(`${userName}님이 ${timeoutMinutes}분 동안 채팅이 제한되었습니다.`);
            }
            break;
            
        default:
            console.warn('알 수 없는 관리자 액션:', message.action);
    }
}

/**
 * 채널 목록 업데이트
 */
function updateChannelsList() {
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
        
        channelDiv.textContent = channel.name;
        
        // 채널 클릭 시 이벤트 처리
        channelDiv.addEventListener('click', () => {
            switchChannel(channelId);
        });
        
        channelsList.appendChild(channelDiv);
    });
}

/**
 * 채널 전환
 */
function switchChannel(channelId) {
    // 기존 채널과 동일하면 무시
    if (channelId === appState.currentChannel) return;
    
    // 채널 유효성 확인
    if (!appState.channels[channelId]) {
        showToast('존재하지 않는 채널입니다.');
        return;
    }
    
    // 현재 채널 변경
    appState.currentChannel = channelId;
    
    // 채널 목록 UI 업데이트
    updateChannelsList();
    
    // 채팅 메시지 영역 초기화 및 현재 채널 메시지 표시
    displayMessageHistory();
    
    // 채팅방 제목 업데이트
    UI.roomName.textContent = `채팅방 #${appState.roomId} - ${appState.channels[channelId].name}`;
    
    // 타이핑 인디케이터 업데이트
    updateTypingIndicator();
}

/**
 * 새 채널 추가
 */
function addChannel(channelName) {
    // 채널 이름 유효성 검사
    if (!channelName || channelName.trim().length === 0) {
        showToast('채널 이름을 입력해주세요.');
        return false;
    }
    
    // 중복 채널 이름 확인
    const channelExists = Object.values(appState.channels).some(
        channel => channel.name.toLowerCase() === channelName.toLowerCase()
    );
    
    if (channelExists) {
        showToast('이미 존재하는 채널 이름입니다.');
        return false;
    }
    
    // 채널 ID 생성 (고유 ID)
    const channelId = 'channel_' + Date.now();
    
    // 로컬 채널 추가
    appState.channels[channelId] = {
        name: channelName,
        messages: []
    };
    
    // 채널 생성 메시지 브로드캐스트
    broadcastMessage({
        type: 'channel',
        action: 'create',
        channelId: channelId,
        channelName: channelName
    });
    
    // 채널 목록 업데이트
    updateChannelsList();
    
    // 새 채널로 전환
    switchChannel(channelId);
    
    return true;
}

/**
 * 채널 삭제
 */
function deleteChannel(channelId) {
    // 유효성 검사
    if (!appState.channels[channelId]) {
        showToast('존재하지 않는 채널입니다.');
        return false;
    }
    
    // 기본 채널은 삭제 불가
    if (channelId === 'general') {
        showToast('기본 채널은 삭제할 수 없습니다.');
        return false;
    }
    
    // 관리자 권한 확인
    if (!appState.isHost && !appState.isAdmin) {
        showToast('채널 삭제 권한이 없습니다.');
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
    addSystemMessage(`채널 "${channelName}"이(가) 삭제되었습니다.`);
    
    return true;
}

/**
 * 채널 추가 프롬프트 표시
 */
function showAddChannelPrompt() {
    const channelName = prompt('추가할 채널 이름을 입력하세요:');
    if (channelName && channelName.trim()) {
        addChannel(channelName.trim());
    }
}

/**
 * 알림 권한 확인
 */
function checkNotificationPermission() {
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
}

/**
 * 알림 권한 요청
 */
function requestNotificationPermission() {
    if (!('Notification' in window)) {
        showToast('이 브라우저는 알림을 지원하지 않습니다.');
        return Promise.reject('notifications-not-supported');
    }
    
    return Notification.requestPermission()
        .then(permission => {
            appState.notifications.permission = permission;
            updateNotificationUI();
            
            if (permission === 'granted') {
                showToast('알림 권한이 허용되었습니다.');
                return true;
            } else {
                showToast('알림 권한이 거부되었습니다. 브라우저 설정에서 권한을 변경할 수 있습니다.');
                return false;
            }
        });
}

/**
 * 알림 UI 업데이트
 */
function updateNotificationUI() {
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
}

/**
 * 데스크톱 알림 표시
 */
function showDesktopNotification(title, message) {
    // 알림 설정 확인
    if (!appState.notifications.desktop) return;
    
    // 알림 권한 확인
    if (appState.notifications.permission !== 'granted') return;
    
    // 문서가 현재 포커스 상태인지 확인
    if (document.visibilityState === 'visible') return;
    
    // 알림 생성
    try {
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
    const settings = {
        enabled: appState.notifications.enabled,
        desktop: appState.notifications.desktop,
        sound: appState.notifications.sound
    };
    
    LocalStorage.save('notificationSettings', settings);
}

/**
 * 연결 상태 업데이트
 */
function updateConnectionStatusFromPeers() {
    const connections = Object.keys(appState.connections).length;
    
    if (connections === 0) {
        if (appState.isHost) {
            updateConnectionStatus('대기 중 (0명)', 'waiting');
        } else {
            updateConnectionStatus('연결 끊김', 'disconnected');
        }
    } else {
        updateConnectionStatus(`연결됨 (${connections}명)`, 'connected');
    }
}

/**
 * P2P 메시 네트워크 구축 (모든 피어끼리 연결)
 */
function connectToPeer(peerId) {
    // 이미 연결되어 있는 경우 건너뜀
    if (appState.connections[peerId] || peerId === appState.localUserId) {
        return;
    }
    
    console.log('피어에 직접 연결 시도:', peerId);
    
    try {
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
            
            // 호스트가 아니고, 연결이 호스트였던 경우에만 특별 처리
            if (!appState.isHost && peerId === appState.roomId) {
                handleHostDisconnect();
            } else {
                handlePeerDisconnect(peerId);
            }
        });
        
        conn.on('error', (err) => {
            console.error('피어 직접 연결 오류:', err);
        });
    } catch (err) {
        console.error('피어 직접 연결 시도 중 예외 발생:', err);
    }
}

/**
 * 호스트 연결 종료 감지 및 처리
 */
function handleHostDisconnect() {
    showToast('호스트와의 연결이 끊어졌습니다. 새 호스트 선출 중...', 5000, 'warning');
    
    // 새 호스트 선출 시도
    setTimeout(() => {
        electNewHost();
    }, 1000);
}

/**
 * 로컬 스토리지 유틸리티
 */
const LocalStorage = {
    /**
     * 로컬 스토리지에 데이터 저장
     */
    save: function(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
            return true;
        } catch (e) {
            console.error('로컬 스토리지 저장 오류:', e);
            return false;
        }
    },
    
    /**
     * 로컬 스토리지에서 데이터 불러오기
     */
    load: function(key, defaultValue = null) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : defaultValue;
        } catch (e) {
            console.error('로컬 스토리지 불러오기 오류:', e);
            return defaultValue;
        }
    },
    
    /**
     * 로컬 스토리지에서 데이터 삭제
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

/**
 * 유틸리티 함수: 이름에서 색상 생성
 */
function getColorFromName(name) {
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
 */
function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
    else return (bytes / 1073741824).toFixed(1) + ' GB';
}

/**
 * 유틸리티 함수: 클립보드에 복사
 */
function copyToClipboard(text) {
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
}

/**
 * 폴백 클립보드 복사 메서드
 */
function fallbackCopyToClipboard(text) {
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
}

/**
 * 유틸리티 함수: 채팅창 스크롤 맨 아래로
 */
function scrollToBottom() {
    if (!UI.chatMessages) return;
    
    UI.chatMessages.scrollTop = UI.chatMessages.scrollHeight;
}

/**
 * 유틸리티 함수: 토스트 메시지 표시
 */
function showToast(message, duration = 3000, type = 'info') {
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
}

// 메시지 삭제 함수를 전역 스코프에 추가 (HTML에서 직접 호출용)
window.deleteMessage = deleteMessage;

// 앱 초기화
document.addEventListener('DOMContentLoaded', initializeApp);
