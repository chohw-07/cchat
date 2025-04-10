/**
 * cchat - 서버 없는 P2P 채팅 애플리케이션
 * PeerJS 라이브러리를 사용하여 브라우저 간 직접 통신
 */

// 상수 정의
const APP_NAME = 'cchat';
const DOMAIN = 'cchat.kro.kr';
const MAX_RETRY_COUNT = 3;

// 애플리케이션 상태
const appState = {
    peer: null,                 // PeerJS 인스턴스
    connections: {},            // 연결된 피어들
    localUserId: null,          // 로컬 사용자 ID
    localUserName: null,        // 로컬 사용자 이름
    roomId: null,               // 현재 방 ID
    isHost: false,              // 방 생성자 여부
    users: {},                  // 연결된 사용자들
    pendingMessages: [],        // 대기 중인 메시지들
    fileChunks: {},             // 파일 청크 저장소
    connectionRetryCount: 0,    // 연결 재시도 횟수
};

// UI 요소
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
    
    // 메인 UI
    chatScreen: document.getElementById('chatScreen'),
    userName: document.getElementById('userName'),
    inviteBtn: document.getElementById('inviteBtn'),
    roomName: document.getElementById('roomName'),
    chatMessages: document.getElementById('chatMessages'),
    messageInput: document.getElementById('messageInput'),
    sendMessageBtn: document.getElementById('sendMessageBtn'),
    usersList: document.getElementById('usersList'),
    connectionStatus: document.getElementById('connectionStatus'),
    fileInput: document.getElementById('fileInput'),
    qrContainer: document.getElementById('qrContainer'),
};

/**
 * 애플리케이션 초기화
 */
function initializeApp() {
    console.log(`${APP_NAME} 애플리케이션 초기화 중...`);
    
    // 로컬 스토리지에서 사용자 이름 불러오기
    const savedUserName = localStorage.getItem('userName');
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
    
    // URL에서 초대 코드 확인
    checkUrlForInviteCode();
    
    // 이벤트 리스너 설정
    setupEventListeners();
}

/**
 * URL에서 초대 코드 확인
 */
function checkUrlForInviteCode() {
    try {
        // 로컬 파일 시스템에서 실행 중인 경우
        if (window.location.protocol === 'file:') {
            // URL에서 초대 코드 감지 안함
            console.log('로컬 환경에서는 URL에서 초대 코드를 자동으로 감지하지 않습니다.');
            return;
        }
        
        // 웹 서버에서 실행 중인 경우
        const pathName = window.location.pathname;
        if (pathName && pathName.length > 1) {
            // URL 경로에서 첫 번째 '/' 이후의 문자열을 초대 코드로 사용
            const inviteCode = pathName.substring(1);
            
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
    // 모달 버튼 리스너
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
    
    // 채팅 관련
    UI.sendMessageBtn.addEventListener('click', sendChatMessage);
    
    UI.messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendChatMessage();
        }
    });
    
    // 파일 전송
    UI.fileInput.addEventListener('change', handleFileSelection);
    
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
}

/**
 * 사용자 이름 저장
 */
function saveUserName(userName) {
    appState.localUserName = userName;
    UI.userName.textContent = userName;
    localStorage.setItem('userName', userName);
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
    
    // 연결 과정 시작
    showConnectionModal();
    updateConnectionStep(1, 'active');
    
    // PeerJS 인스턴스 생성
    appState.peer = new Peer(roomId, {
        debug: 1, // 디버그 레벨 낮춤
        config: {
            'iceServers': [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        }
    });
    
    // PeerJS 이벤트 리스너 설정
    setupPeerEvents();
    
    // UI 업데이트
    UI.roomName.textContent = `채팅방 #${roomId}`;
    
    // URL 업데이트
    updateUrlWithRoomId(roomId);
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
    
    // PeerJS 인스턴스 생성
    appState.peer = new Peer(peerId, {
        debug: 1, // 디버그 레벨 낮춤
        config: {
            'iceServers': [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
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
}

/**
 * 호스트에 연결
 */
function connectToHost(hostId) {
    console.log('호스트에 연결 시도:', hostId);
    
    const conn = appState.peer.connect(hostId, {
        reliable: true
    });
    
    conn.on('open', () => {
        console.log('호스트에 연결됨');
        updateConnectionStep(2, 'complete');
        updateConnectionStep(3, 'active');
        
        // 연결 정보 저장
        appState.connections[hostId] = conn;
        
        // 자신의 정보 전송
        sendData(conn, {
            type: 'system',
            action: 'user_info',
            userId: appState.localUserId,
            userName: appState.localUserName
        });
        
        // 연결 성공 처리
        onConnectionSuccess();
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
        handleConnectionError('호스트 연결 중 오류가 발생했습니다.');
    });
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
                userName: appState.localUserName
            });
            
            // 현재 접속 중인 다른 사용자 정보 전송 (호스트만)
            if (appState.isHost) {
                Object.entries(appState.users).forEach(([userId, userName]) => {
                    if (userId !== appState.localUserId && userId !== conn.peer) {
                        sendData(conn, {
                            type: 'system',
                            action: 'user_info',
                            userId: userId,
                            userName: userName
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
        } else {
            handleConnectionError('연결 중 오류가 발생했습니다.');
        }
    });
    
    appState.peer.on('disconnected', () => {
        console.log('PeerJS 서버와 연결 끊김');
        
        // 자동 재연결 시도
        setTimeout(() => {
            if (appState.peer && appState.connectionRetryCount < MAX_RETRY_COUNT) {
                appState.connectionRetryCount++;
                console.log(`재연결 시도 ${appState.connectionRetryCount}/${MAX_RETRY_COUNT}`);
                appState.peer.reconnect();
            } else {
                handleConnectionError('서버와 연결할 수 없습니다. 다시 시도해주세요.');
            }
        }, 1000);
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
}

/**
 * 연결 오류 처리
 */
function handleConnectionError(message) {
    console.error('연결 오류:', message);
    
    // 현재 활성화된 단계를 오류 상태로 변경
    for (let i = 1; i <= 3; i++) {
        const step = document.getElementById(`step${i}`);
        if (step.classList.contains('active')) {
            step.classList.remove('active');
            step.classList.add('error');
        }
    }
    
    // 오류 메시지 표시
    UI.connectionError.classList.remove('hidden');
    document.querySelector('.error-message').textContent = message;
    
    // 연결 상태 업데이트
    updateConnectionStatus('연결 실패', 'disconnected');
}

/**
 * 연결 성공 처리
 */
function onConnectionSuccess() {
    updateConnectionStep(3, 'complete');
    
    // 자신을 사용자 목록에 추가
    appState.users[appState.localUserId] = appState.localUserName;
    
    // 모달 닫기 (지연 적용)
    setTimeout(() => {
        UI.connectionModal.classList.add('hidden');
        updateConnectionStatus('연결됨', 'connected');
        updateUsersList();
    }, 1000);
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
            // 채팅 메시지 표시
            addChatMessage(message.userName, message.content, message.timestamp);
            break;
            
        case 'system':
            // 시스템 메시지 처리
            handleSystemMessage(message, fromPeerId);
            break;
            
        case 'file':
            // 파일 메시지 처리
            handleFileMessage(message, fromPeerId);
            break;
            
        default:
            console.warn('알 수 없는 메시지 유형:', message.type);
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
        (message.action === 'user_info' || message.action === 'peer_disconnect')) {
        relayMessageToAllPeers(message, fromPeerId);
    }
    
    switch (message.action) {
        case 'user_info':
            // 사용자 정보 업데이트
            const isNewUser = !appState.users[message.userId];
            appState.users[message.userId] = message.userName;
            
            // UI 업데이트
            updateUsersList();
            
            // 새 사용자 안내 메시지
            if (isNewUser && message.userId !== appState.localUserId) {
                addSystemMessage(`${message.userName}님이 입장했습니다.`);
            }
            break;
            
        case 'peer_disconnect':
            // 피어 연결 종료 알림
            handlePeerDisconnect(message.userId);
            break;
            
        case 'host_info':
            // 호스트 정보 수신
            if (message.isHost && message.userId !== appState.localUserId) {
                console.log(`${message.userId}가 호스트입니다.`);
                // 호스트 정보를 저장할 수 있음
            }
            break;
            
        default:
            console.warn('알 수 없는 시스템 메시지 액션:', message.action);
    }
}

/**
 * 피어 연결 종료 처리
 */
function handlePeerDisconnect(peerId) {
    // 연결 객체에서 제거
    if (appState.connections[peerId]) {
        delete appState.connections[peerId];
    }
    
    // 사용자가 존재하는 경우 사용자 목록에서 제거
    if (appState.users[peerId]) {
        const userName = appState.users[peerId];
        delete appState.users[peerId];
        updateUsersList();
        addSystemMessage(`${userName}님이 퇴장했습니다.`);
    }
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
            
            // 파일 청크 저장소 초기화
            appState.fileChunks[message.fileId] = {
                fileName: message.fileName,
                fileType: message.fileType,
                fileSize: message.fileSize,
                chunks: [],
                receivedChunks: 0,
                totalChunks: message.totalChunks
            };
            
            // 파일 전송 시작 메시지 표시
            addFileTransferMessage(
                message.userName, 
                message.fileName, 
                message.fileSize, 
                message.fileId, 
                0
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
                    delete appState.fileChunks[message.fileId];
                }
            }
            break;
            
        default:
            console.warn('알 수 없는 파일 메시지 액션:', message.action);
    }
}

/**
 * 채팅 메시지 전송
 */
function sendChatMessage() {
    const messageText = UI.messageInput.value.trim();
    if (!messageText) return;
    
    const chatMessage = {
        type: 'chat',
        content: messageText,
        userName: appState.localUserName,
        timestamp: Date.now()
    };
    
    // 메시지를 모든 피어에게 전송
    broadcastMessage(chatMessage);
    
    // 자신의 메시지 표시
    addChatMessage(appState.localUserName, messageText, chatMessage.timestamp);
    
    // 입력 필드 초기화
    UI.messageInput.value = '';
}

/**
 * 파일 선택 처리
 */
function handleFileSelection(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    console.log('파일 선택됨:', file.name, file.type, file.size);
    
    // 파일 크기 제한 (예: 10MB)
    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
        showToast('파일 크기는 10MB를 초과할 수 없습니다.');
        return;
    }
    
    // 파일 ID 생성
    const fileId = `file_${Date.now()}`;
    
    // 청크 크기 및 총 청크 수 계산
    const CHUNK_SIZE = 16 * 1024; // 16KB
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    
    // 파일 정보 메시지 생성
    const fileInfoMessage = {
        type: 'file',
        action: 'file_info',
        fileId: fileId,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        totalChunks: totalChunks,
        userName: appState.localUserName,
        timestamp: Date.now()
    };
    
    // 파일 정보 메시지 broadcast
    broadcastMessage(fileInfoMessage);
    
    // 파일 전송 시작 메시지 표시
    addFileTransferMessage(
        appState.localUserName, 
        file.name, 
        file.size, 
        fileId, 
        0
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
        // 연결된 것 중 첫 번째가 호스트임 (첫 연결은 항상 호스트와의 연결)
        const hostConn = Object.values(appState.connections)[0];
        if (hostConn) {
            sendData(hostConn, message);
        } else {
            console.warn('호스트와 연결되지 않았습니다. 메시지 전송 불가.');
            // 연결이 없는 경우 큐에 저장
            appState.pendingMessages.push(message);
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
        inviteLink = `${DOMAIN}/${appState.roomId}`;
    } else {
        inviteLink = `${window.location.origin}/${appState.roomId}`;
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
    
    new QRCode(UI.qrContainer, {
        text: data,
        width: 128,
        height: 128,
        colorDark: '#5865F2',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.H
    });
}

/**
 * URL 경로 업데이트
 */
function updateUrlWithRoomId(roomId) {
    try {
        // 로컬 파일에서 실행 여부 확인 (file:// 프로토콜)
        if (window.location.protocol !== 'file:') {
            const newUrl = `${window.location.origin}/${roomId}`;
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
    
    // UI 초기화
    updateUsersList();
}

/**
 * 채팅 메시지 추가
 */
function addChatMessage(userName, text, timestamp) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message';
    
    const time = new Date(timestamp);
    const timeString = `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`;
    
    // 자신의 메시지인지 확인
    const isMe = userName === appState.localUserName;
    
    messageDiv.innerHTML = `
        <div class="message-avatar" style="background-color: ${getColorFromName(userName)}"></div>
        <div class="message-content">
            <div class="message-header">
                <span class="message-author">${userName}${isMe ? ' (나)' : ''}</span>
                <span class="message-time">${timeString}</span>
            </div>
            <div class="message-text">${escapeHtml(text)}</div>
        </div>
    `;
    
    UI.chatMessages.appendChild(messageDiv);
    scrollToBottom();
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
function addFileTransferMessage(userName, fileName, fileSize, fileId, progress) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message';
    messageDiv.id = `file-message-${fileId}`;
    
    const time = new Date();
    const timeString = `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`;
    const formattedSize = formatFileSize(fileSize);
    
    // 자신의 파일인지 확인
    const isMe = userName === appState.localUserName;
    
    messageDiv.innerHTML = `
        <div class="message-avatar" style="background-color: ${getColorFromName(userName)}"></div>
        <div class="message-content">
            <div class="message-header">
                <span class="message-author">${userName}${isMe ? ' (나)' : ''}</span>
                <span class="message-time">${timeString}</span>
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
    Object.entries(appState.users).forEach(([userId, userName]) => {
        const userDiv = document.createElement('div');
        userDiv.className = 'user-item';
        
        // 자신인지 확인
        const isMe = userId === appState.localUserId;
        // 호스트인지 확인
        const isHost = appState.isHost && isMe;
        
        userDiv.innerHTML = `
            <div class="user-item-avatar" style="background-color: ${getColorFromName(userName)}"></div>
            <div class="user-item-name">${userName}${isMe ? ' (나)' : ''}${isHost ? ' 👑' : ''}</div>
        `;
        
        UI.usersList.appendChild(userDiv);
    });
}

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
        '#EB459E'  // 분홍
    ];
    
    return colors[Math.abs(hash) % colors.length];
}

/**
 * 유틸리티 함수: HTML 이스케이프
 */
function escapeHtml(unsafe) {
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
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
}

/**
 * 유틸리티 함수: 채팅창 스크롤 맨 아래로
 */
function scrollToBottom() {
    UI.chatMessages.scrollTop = UI.chatMessages.scrollHeight;
}

/**
 * 유틸리티 함수: 토스트 메시지 표시
 */
function showToast(message) {
    // 기존 토스트 제거
    const existingToast = document.querySelector('.toast');
    if (existingToast) {
        document.body.removeChild(existingToast);
    }
    
    // 새 토스트 생성
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    
    // 스타일 추가
    toast.style.position = 'fixed';
    toast.style.bottom = '20px';
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%)';
    toast.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    toast.style.color = 'white';
    toast.style.padding = '10px 20px';
    toast.style.borderRadius = '5px';
    toast.style.zIndex = '1000';
    
    // 문서에 추가
    document.body.appendChild(toast);
    
    // 일정 시간 후 제거
    setTimeout(() => {
        if (document.body.contains(toast)) {
            document.body.removeChild(toast);
        }
    }, 3000);
}

// 앱 초기화
document.addEventListener('DOMContentLoaded', initializeApp);
