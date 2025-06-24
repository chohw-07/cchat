// 강의 차시 자동 진행 시스템 (완전판) - 내용과 차시 모두 자동화
(function() {
    // === 기본 설정값들 ===
    const CHECK_INTERVAL = 1000; // 1초마다 체크 (사람이 보기에 자연스러운 속도)
    const TARGET_WIDTH = 1000; // 강의 완료 기준 width (100% = 1000px)
    const NEXT_DELAY = 3000; // 다음 강의로 이동 전 대기시간 (너무 빠르면 부자연스러움)
    const FORCE_RESET_INTERVAL = 30000; // 30초마다 강제 상태 체크
    const COURSE_SWITCH_DELAY = 5000; // 차시 변경 후 대기 시간
    
    // === 상태 변수들 ===
    let isProcessing = false; // 현재 처리 중인지 여부
    let lastWidth = 0; // 마지막으로 확인한 진도 width
    let jogProgressElement = null; // jogProgress DOM 요소 캐시
    let searchAttempts = 0; // 요소 찾기 시도 횟수
    let currentPageUrl = window.location.href; // 현재 페이지 URL
    let completionHandled = false; // 완료 처리 여부
    let lastProgressTime = Date.now(); // 마지막 진행률 변화 시간
    let stuckCheckCount = 0; // 멈춤 상태 카운트
    let lastIframeSrc = ''; // 이전 iframe src
    
    // === 차시 관련 변수들 ===
    let courseAutoMode = false; // 차시 자동 진행 모드
    let currentCourseIndex = -1; // 현재 차시 인덱스
    let courseList = []; // 전체 차시 목록
    let courseCompletionWaiting = false; // 차시 완료 대기 중
    
    console.log('🚀 강의 완전 자동화 시스템 시작!');
    console.log('📚 내용 자동 진행 + 차시 자동 이동 통합 버전');
    
    // === 차시 데이터 파싱 (실제 HTML에서 정보 추출) ===
    function parseCourseData() {
        try {
            courseList = []; // 초기화
            
            // HTML에서 실제 차시 정보 추출 (li 요소들)
            const courseItems = document.querySelectorAll('.len_li li');
            
            courseItems.forEach((item, index) => {
                const nameElement = item.querySelector('.name');
                const buttonElement = item.querySelector('.c_btn');
                const progressElement = item.querySelector('.progress');
                
                if (nameElement && buttonElement) {
                    const courseName = nameElement.textContent.trim();
                    const onclickAttr = buttonElement.getAttribute('onclick');
                    
                    // onclick에서 cntsId와 crsStudySylbId 추출
                    let cntsId = '', crsStudySylbId = '', isAccessible = false;
                    
                    if (onclickAttr && onclickAttr.includes('REQ.studyCntsStart')) {
                        // 정규식으로 파라미터 추출
                        const matches = onclickAttr.match(/REQ\.studyCntsStart\('([^']+)','([^']+)',(\d+),(\d+)\)/);
                        if (matches) {
                            cntsId = matches[1];
                            crsStudySylbId = matches[2];
                            isAccessible = true;
                        }
                    } else if (onclickAttr && onclickAttr.includes('COMMT.message')) {
                        // 순차 학습 제한이 걸린 경우
                        isAccessible = false;
                    }
                    
                    // 진행률 체크 (circleProgress value 확인)
                    let progressPercent = 0;
                    if (progressElement) {
                        const progressId = progressElement.id;
                        // JavaScript에서 설정된 value 확인
                        const scriptContent = document.documentElement.innerHTML;
                        const progressRegex = new RegExp(`#${progressId}'\\)\\.circleProgress\\({\\s*value:\\s*([\\d.]+)`);
                        const progressMatch = scriptContent.match(progressRegex);
                        if (progressMatch) {
                            progressPercent = parseFloat(progressMatch[1]) * 100;
                        }
                    }
                    
                    courseList.push({
                        index: index,
                        name: courseName,
                        cntsId: cntsId,
                        crsStudySylbId: crsStudySylbId,
                        isAccessible: isAccessible,
                        isCompleted: progressPercent >= 100,
                        progressPercent: progressPercent,
                        element: item
                    });
                }
            });
            
            console.log('📋 차시 데이터 파싱 완료:', courseList.length + '개');
            courseList.forEach((course, idx) => {
                console.log(`  ${idx + 1}. ${course.name} (진행률: ${course.progressPercent}%, 접근가능: ${course.isAccessible})`);
            });
            
            return courseList.length > 0;
            
        } catch (error) {
            console.error('💥 차시 데이터 파싱 오류:', error);
            return false;
        }
    }
    
    // === 다음 학습 가능한 차시 찾기 ===
    function findNextAvailableCourse() {
        for (let i = 0; i < courseList.length; i++) {
            const course = courseList[i];
            // 완료되지 않았고 접근 가능한 차시
            if (!course.isCompleted && course.isAccessible) {
                return i;
            }
        }
        return -1; // 더 이상 학습할 차시 없음
    }
    
    // === 차시 자동 시작 ===
    function startNextCourse() {
        try {
            // 차시 데이터 최신화
            if (!parseCourseData()) {
                console.log('❌ 차시 데이터 파싱 실패');
                return false;
            }
            
            const nextIndex = findNextAvailableCourse();
            
            if (nextIndex === -1) {
                console.log('🎉 모든 차시 완료! 자동 진행 종료');
                courseAutoMode = false;
                alert('🎉 축하합니다! 모든 차시를 완료했습니다!');
                return false;
            }
            
            const nextCourse = courseList[nextIndex];
            console.log(`🎯 다음 차시 시작: ${nextCourse.name}`);
            
            // 현재 차시 인덱스 업데이트
            currentCourseIndex = nextIndex;
            
            // REQ.studyCntsStart 함수 호출
            if (typeof REQ !== 'undefined' && REQ.studyCntsStart) {
                console.log(`📖 차시 시작: cntsId=${nextCourse.cntsId}, crsStudySylbId=${nextCourse.crsStudySylbId}`);
                
                // 상태 초기화 후 차시 시작
                resetAllStates('차시 변경');
                
                // 실제 차시 시작
                REQ.studyCntsStart(
                    nextCourse.cntsId, 
                    nextCourse.crsStudySylbId, 
                    1300, 
                    800
                );
                
                // 차시 시작 후 잠시 대기
                courseCompletionWaiting = true;
                setTimeout(() => {
                    courseCompletionWaiting = false;
                    console.log('✅ 차시 시작 완료, 내용 자동 진행 모드 활성화');
                }, COURSE_SWITCH_DELAY);
                
                return true;
            } else {
                console.log('❌ REQ.studyCntsStart 함수를 찾을 수 없음');
                return false;
            }
            
        } catch (error) {
            console.error('💥 차시 시작 오류:', error);
            return false;
        }
    }
    
    // === 상태 완전 초기화 함수 ===
    function resetAllStates(reason = '일반') {
        console.log(`🔄 모든 상태 완전 초기화 중... (이유: ${reason})`);
        
        const oldProcessing = isProcessing;
        const oldCompleted = completionHandled;
        
        isProcessing = false;
        lastWidth = 0;
        jogProgressElement = null;
        searchAttempts = 0;
        completionHandled = false;
        stuckCheckCount = 0;
        lastProgressTime = Date.now();
        
        // 차시 완료 대기 상태는 특별한 경우에만 리셋
        if (reason !== '차시 변경') {
            courseCompletionWaiting = false;
        }
        
        console.log('✅ 상태 초기화 완료');
        console.log(`- isProcessing: ${oldProcessing} → ${isProcessing}`);
        console.log(`- completionHandled: ${oldCompleted} → ${completionHandled}`);
        console.log(`- courseAutoMode: ${courseAutoMode}`);
    }
    
    // === iframe 변경 감지 ===
    function detectIframeChange() {
        try {
            const iframe = document.querySelector('iframe[src*="/contents/"]') || 
                          document.querySelector('iframe');
            
            if (iframe && iframe.src && iframe.src !== lastIframeSrc) {
                console.log('📺 iframe 변경 감지!');
                console.log('  이전 src:', lastIframeSrc);
                console.log('  현재 src:', iframe.src);
                
                lastIframeSrc = iframe.src;
                resetAllStates('iframe 변경');
                return true;
            }
            
            return false;
        } catch (error) {
            return false;
        }
    }
    
    // === 진행률이 오랫동안 변하지 않을 때 상태 리셋 ===
    function checkStuckState() {
        const currentTime = Date.now();
        
        // 30초 이상 진행률이 변하지 않고 processing 상태면 리셋
        if (isProcessing && (currentTime - lastProgressTime) > 30000) {
            console.log('⚠️ 30초 이상 진행률 변화 없음, 강제 상태 리셋');
            resetAllStates('멈춤 상태 감지');
            return true;
        }
        
        // isProcessing이 true인데 jogProgress가 1000 미만이면 리셋
        const element = findJogProgress();
        if (element && isProcessing) {
            const currentWidth = parseInt(element.style.width) || 0;
            if (currentWidth < TARGET_WIDTH) {
                console.log(`🔄 processing 상태지만 width가 ${currentWidth}px, 상태 리셋`);
                resetAllStates('width 불일치');
                return true;
            }
        }
        
        return false;
    }
    
    // === jogProgress 요소 찾기 ===
    function findJogProgress() {
        try {
            // 캐시된 요소가 아직 유효한지 확인
            if (jogProgressElement && document.contains(jogProgressElement)) {
                return jogProgressElement;
            }
            
            jogProgressElement = null;
            searchAttempts++;
            
            // 너무 자주 로그가 나오지 않도록 조절
            if (searchAttempts % 20 === 1) {
                console.log(`🔍 jogProgress 탐색 시도 ${searchAttempts}번째...`);
            }
            
            // 1. 메인 페이지에서 찾기
            let element = document.getElementById('jogProgress');
            if (element) {
                jogProgressElement = element;
                return element;
            }
            
            // 2. iframe 내부에서 찾기
            const iframes = document.querySelectorAll('iframe');
            for (let iframe of iframes) {
                try {
                    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                    if (iframeDoc) {
                        element = iframeDoc.getElementById('jogProgress');
                        if (element) {
                            jogProgressElement = element;
                            return element;
                        }
                    }
                } catch (e) {
                    // CORS 에러 무시 (다른 도메인의 iframe)
                }
            }
            
            return null;
            
        } catch (error) {
            console.error('💥 jogProgress 탐색 중 오류:', error);
            return null;
        }
    }
    
    // === jogProgress 감시 - 핵심 로직 ===
    function checkJogProgress() {
        try {
            // 차시 완료 대기 중이면 스킵
            if (courseCompletionWaiting) {
                return;
            }
            
            // 1. iframe 변경 감지 (최우선)
            if (detectIframeChange()) {
                return; // iframe이 변경되었으면 이번 체크는 건너뛰기
            }
            
            // 2. 멈춤 상태 체크
            if (checkStuckState()) {
                return; // 상태가 리셋되었으면 이번 체크는 건너뛰기
            }
            
            const element = findJogProgress();
            
            if (!element) {
                return;
            }
            
            // 현재 width 확인
            let currentWidth = parseInt(element.style.width) || 0;
            
            // width 변경 감지
            if (currentWidth !== lastWidth) {
                console.log(`📏 jogProgress width: ${currentWidth}px (처리상태: ${isProcessing ? '진행중' : '대기중'})`);
                lastWidth = currentWidth;
                lastProgressTime = Date.now(); // 진행률 변화 시간 업데이트
                
                // width가 변했으므로 완료 처리 상태 리셋 (단, processing은 유지)
                if (currentWidth < TARGET_WIDTH && completionHandled) {
                    console.log('🔄 width 감소로 completionHandled 리셋');
                    completionHandled = false;
                }
            }
            
            // 강의 완료 조건 체크
            if (currentWidth >= TARGET_WIDTH && !isProcessing) {
                console.log('🎉 강의 완료 감지! 처리 시작');
                console.log(`🔍 현재 상태:`);
                console.log(`  - currentWidth: ${currentWidth}px`);
                console.log(`  - isProcessing: ${isProcessing}`);
                console.log(`  - completionHandled: ${completionHandled}`);
                console.log(`  - courseAutoMode: ${courseAutoMode}`);
                
                // 즉시 처리 상태로 변경
                isProcessing = true;
                completionHandled = true;
                
                if (courseAutoMode) {
                    console.log('🔄 차시 자동 모드: nextBubble 클릭 시도');
                    setTimeout(() => {
                        handleCourseCompletion();
                    }, NEXT_DELAY);
                } else {
                    console.log('📖 일반 모드: nextBubble 클릭');
                    setTimeout(() => {
                        moveToNextLecture();
                    }, NEXT_DELAY);
                }
            }
            
        } catch (error) {
            console.error('💥 jogProgress 체크 중 오류:', error);
        }
    }
    
    // === 차시 완료 처리 (새로운 핵심 함수) ===
    function handleCourseCompletion() {
        console.log('🎯 차시 완료 처리 시작');
        
        // 먼저 nextBubble 클릭 시도
        const nextSuccess = clickNextBubbleInIframe();
        
        if (nextSuccess) {
            console.log('✅ nextBubble 클릭 성공, 잠시 후 다음 차시 확인');
            
            // nextBubble 클릭 후 페이지 변화 대기
            setTimeout(() => {
                console.log('🔍 차시 완료 후 다음 차시 체크');
                
                // 차시 데이터 새로고침
                parseCourseData();
                
                // 현재 차시가 완료되었는지 확인
                if (currentCourseIndex >= 0 && currentCourseIndex < courseList.length) {
                    const currentCourse = courseList[currentCourseIndex];
                    console.log(`📊 현재 차시(${currentCourse.name}) 완료 상태: ${currentCourse.isCompleted}`);
                }
                
                // 다음 차시 시작
                setTimeout(() => {
                    console.log('🚀 다음 차시 자동 시작 시도');
                    startNextCourse();
                }, 2000);
                
            }, 3000);
            
        } else {
            console.log('❌ nextBubble 클릭 실패, 재시도');
            
            setTimeout(() => {
                if (isProcessing) {
                    console.log('🔄 nextBubble 재시도');
                    handleCourseCompletion();
                }
            }, 5000);
        }
    }
    
    // === nextBubble 버튼 클릭 ===
    function clickNextBubbleInIframe() {
        try {
            console.log('🔍 nextBubble 버튼 찾는 중...');
            
            const iframes = document.querySelectorAll('iframe');
            
            for (let i = 0; i < iframes.length; i++) {
                const iframe = iframes[i];
                
                try {
                    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                    
                    if (!iframeDoc) continue;
                    
                    const nextBubble = iframeDoc.getElementById('nextBubble');
                    
                    if (!nextBubble) continue;
                    
                    // 버튼이 보이는지 확인
                    const isVisible = nextBubble.style.display !== 'none' && 
                                     nextBubble.offsetWidth > 0 && 
                                     nextBubble.offsetHeight > 0;
                    
                    console.log(`📺 iframe ${i + 1}: nextBubble 발견 (표시: ${isVisible ? '보임' : '숨김'})`);
                    
                    if (isVisible) {
                        console.log('🎉 nextBubble 클릭 실행!');
                        
                        try {
                            nextBubble.click();
                            console.log('✅ nextBubble 클릭 성공');
                        } catch (clickError) {
                            const clickEvent = new MouseEvent('click', {
                                bubbles: true,
                                cancelable: true,
                                view: iframe.contentWindow
                            });
                            nextBubble.dispatchEvent(clickEvent);
                            console.log('✅ dispatchEvent 클릭 성공');
                        }
                        
                        return true;
                    } else {
                        console.log('⏳ nextBubble 아직 준비되지 않음');
                        return false;
                    }
                    
                } catch (iframeError) {
                    continue; // 다음 iframe으로
                }
            }
            
            // 외부에서도 찾아보기
            const externalNextBubble = document.getElementById('nextBubble');
            if (externalNextBubble && externalNextBubble.style.display !== 'none') {
                console.log('🎯 외부 페이지에서 nextBubble 발견 및 클릭!');
                externalNextBubble.click();
                return true;
            }
            
            console.log('❌ nextBubble을 찾을 수 없음');
            return false;
            
        } catch (error) {
            console.error('💥 nextBubble 클릭 중 오류:', error);
            return false;
        }
    }
    
    // === 다음 강의로 이동 (기존 로직) ===
    function moveToNextLecture() {
        console.log('🚀 moveToNextLecture 실행 (일반 모드)');
        
        const success = clickNextBubbleInIframe();
        
        if (!success) {
            console.log('⚠️ nextBubble 클릭 실패, 5초 후 재시도...');
            
            setTimeout(() => {
                if (isProcessing) {
                    console.log('🔄 nextBubble 재시도 중...');
                    const retrySuccess = clickNextBubbleInIframe();
                    
                    if (!retrySuccess) {
                        console.log('❌ 재시도도 실패, 상태 강제 리셋');
                        resetAllStates('버튼 클릭 실패');
                    }
                }
            }, 5000);
        } else {
            // 일반 모드에서는 클릭 후 상태만 리셋
            setTimeout(() => {
                resetAllStates('일반 모드 완료');
            }, 3000);
        }
    }
    
    // === 주기적 상태 체크 (추가 안전장치) ===
    function periodicStateCheck() {
        try {
            const element = findJogProgress();
            
            // jogProgress가 있는데 isProcessing이 true이고 width가 1000 미만이면 문제
            if (element && isProcessing) {
                const currentWidth = parseInt(element.style.width) || 0;
                
                if (currentWidth < TARGET_WIDTH) {
                    console.log(`🔧 주기적 체크: width ${currentWidth}px인데 processing 상태, 리셋`);
                    resetAllStates('주기적 체크');
                }
            }
            
            // 처리 중인데 너무 오래되면 리셋
            if (isProcessing && (Date.now() - lastProgressTime) > 60000) {
                console.log('🔧 주기적 체크: 60초 이상 처리 중, 강제 리셋');
                resetAllStates('60초 타임아웃');
            }
            
        } catch (error) {
            console.error('💥 주기적 상태 체크 오류:', error);
        }
    }
    
    // === 시스템 상태 확인 ===
    function checkSystemStatus() {
        const element = findJogProgress();
        console.log('📊 === 시스템 상태 ===');
        console.log('- jogProgress 요소:', element ? '발견됨' : '없음');
        if (element) {
            const width = parseInt(element.style.width) || 0;
            console.log('- 현재 width:', width + 'px');
            console.log('- 목표 width:', TARGET_WIDTH + 'px');
        }
        console.log('- 처리 중:', isProcessing);
        console.log('- 완료 처리됨:', completionHandled);
        console.log('- 차시 자동 모드:', courseAutoMode);
        console.log('- 현재 차시 인덱스:', currentCourseIndex);
        console.log('- 마지막 진행 시간:', new Date(lastProgressTime).toLocaleTimeString());
        console.log('- 현재 iframe src:', lastIframeSrc);
        console.log('=====================');
    }
    
    // === 전역 제어 함수들 ===
    
    // 차시 자동 모드 시작
    window.startCourseAutoMode = function() {
        console.log('🎯 차시 자동 진행 모드 시작!');
        courseAutoMode = true;
        
        // 차시 데이터 파싱
        if (parseCourseData()) {
            console.log('📚 차시 데이터 파싱 성공, 첫 차시 시작');
            startNextCourse();
        } else {
            console.log('❌ 차시 데이터 파싱 실패');
            courseAutoMode = false;
        }
    };
    
    // 차시 자동 모드 중지
    window.stopCourseAutoMode = function() {
        console.log('⏹️ 차시 자동 진행 모드 중지');
        courseAutoMode = false;
        resetAllStates('자동 모드 중지');
    };
    
    // 수동으로 다음 차시 시작
    window.startNextCourseManual = function() {
        console.log('🎮 수동으로 다음 차시 시작');
        return startNextCourse();
    };
    
    // 차시 목록 보기
    window.showCourseList = function() {
        console.log('📋 === 차시 목록 ===');
        parseCourseData();
        courseList.forEach((course, idx) => {
            const status = course.isCompleted ? '✅완료' : (course.isAccessible ? '🔓가능' : '🔒잠금');
            console.log(`${idx + 1}. ${course.name} [${status}] (${course.progressPercent}%)`);
        });
        console.log('==================');
        return courseList;
    };
    
    // 기존 함수들 유지
    window.findJogProgressNow = function() {
        jogProgressElement = null;
        searchAttempts = 0;
        const element = findJogProgress();
        console.log('🔍 수동 탐색 결과:', element ? '발견됨' : '없음');
        if (element) {
            const width = parseInt(element.style.width) || 0;
            console.log('📍 발견된 요소: width =', width + 'px');
        }
        return element;
    };
    
    window.checkJogStatus = checkSystemStatus;
    
    window.forceNextPage = function() {
        console.log('🔧 강제 다음 페이지 이동');
        resetAllStates('강제 실행');
        isProcessing = true;
        completionHandled = true;
        if (courseAutoMode) {
            handleCourseCompletion();
        } else {
            moveToNextLecture();
        }
        return true;
    };
    
    window.resetJogSystem = function() {
        console.log('🔄 시스템 완전 리셋');
        resetAllStates('수동 리셋');
        courseAutoMode = false;
        currentCourseIndex = -1;
        courseCompletionWaiting = false;
        currentPageUrl = window.location.href;
        lastIframeSrc = '';
        console.log('✅ 시스템 리셋 완료');
    };
    
    window.findNextBubble = function() {
        console.log('🔍 수동으로 nextBubble 찾기');
        const result = clickNextBubbleInIframe();
        console.log('결과:', result ? '성공' : '실패');
        return result;
    };
    
    window.debugCurrentState = function() {
        console.log('🐛 === 디버그 정보 ===');
        console.log('현재 시간:', new Date().toLocaleTimeString());
        checkSystemStatus();
        
        const element = findJogProgress();
        if (element) {
            console.log('요소 세부정보:');
            console.log('- tagName:', element.tagName);
            console.log('- id:', element.id);
            console.log('- className:', element.className);
            console.log('- style.width:', element.style.width);
            console.log('- offsetWidth:', element.offsetWidth);
        }
        
        console.log('차시 정보:');
        console.log('- courseAutoMode:', courseAutoMode);
        console.log('- currentCourseIndex:', currentCourseIndex);
        console.log('- courseList.length:', courseList.length);
        console.log('==================');
    };
    
    // === DOM 변경 감시 ===
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                for (let node of mutation.addedNodes) {
                    if (node.nodeType === 1) {
                        if (node.id === 'jogProgress' || (node.querySelector && node.querySelector('#jogProgress'))) {
                            console.log('🎯 새로운 jogProgress 감지, 캐시 초기화');
                            jogProgressElement = null;
                        }
                    }
                }
            }
        });
    });
    
    observer.observe(document.body, { 
        childList: true, 
        subtree: true 
    });
    
    // === 주기적 모니터링 시작 ===
    setInterval(checkJogProgress, CHECK_INTERVAL);
    
    // 추가 안전장치: 30초마다 주기적 상태 체크
    setInterval(periodicStateCheck, FORCE_RESET_INTERVAL);
    
    // === 초기화 ===
    setTimeout(() => {
        console.log('🚀 시스템 완전 초기화');
        resetAllStates('시스템 시작');
        
        // 현재 iframe src 기록
        const iframe = document.querySelector('iframe[src*="/contents/"]') || 
                      document.querySelector('iframe');
        if (iframe && iframe.src) {
            lastIframeSrc = iframe.src;
        }
        
        // 차시 데이터 초기 파싱
        parseCourseData();
        
        findJogProgressNow();
        checkSystemStatus();
    }, 1000);
    
    console.log('✨ 강의 완전 자동화 시스템 가동 완료!');
    console.log('🔧 === 사용 가능한 명령어 ===');
    console.log('📚 차시 자동화:');
    console.log('  startCourseAutoMode() - 차시 자동 진행 시작');
    console.log('  stopCourseAutoMode() - 차시 자동 진행 중지');
    console.log('  startNextCourseManual() - 수동으로 다음 차시');
    console.log('  showCourseList() - 차시 목록 보기');
    console.log('');
    console.log('🎮 기본 제어:');
    console.log('  findJogProgressNow() - jogProgress 찾기');
    console.log('  findNextBubble() - nextBubble 찾기');
    console.log('  checkJogStatus() - 상태 확인');
    console.log('  forceNextPage() - 강제 다음 페이지');
    console.log('  resetJogSystem() - 시스템 리셋');
    console.log('  debugCurrentState() - 디버그 정보');
    console.log('=============================');
    
})();
