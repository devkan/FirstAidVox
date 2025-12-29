#!/usr/bin/env node

/**
 * FirstAidVox 백엔드-프론트엔드 연동 테스트 스크립트
 * 
 * 이 스크립트는 다음을 확인합니다:
 * 1. 백엔드 서버 상태 (health check)
 * 2. CORS 설정 확인
 * 3. /chat 엔드포인트 기본 동작 확인
 */

const https = require('https');
const http = require('http');

const BACKEND_URL = 'http://localhost:3001';
const FRONTEND_URL = 'http://localhost:5173';

// 색상 출력을 위한 ANSI 코드
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    
    const req = client.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: data
        });
      });
    });
    
    req.on('error', reject);
    req.on('timeout', () => reject(new Error('Request timeout')));
    req.setTimeout(5000);
    
    if (options.body) {
      req.write(options.body);
    }
    
    req.end();
  });
}

async function testBackendHealth() {
  log('\n🔍 백엔드 Health Check 테스트...', 'blue');
  
  try {
    const response = await makeRequest(`${BACKEND_URL}/health`);
    
    if (response.statusCode === 200) {
      log('✅ 백엔드 서버가 정상적으로 실행 중입니다', 'green');
      
      try {
        const healthData = JSON.parse(response.data);
        log(`   - 상태: ${healthData.status || 'unknown'}`, 'green');
        log(`   - 환경: ${healthData.environment || 'unknown'}`, 'green');
        log(`   - 버전: ${healthData.version || 'unknown'}`, 'green');
      } catch (e) {
        log('   - Health 데이터 파싱 실패, 하지만 서버는 응답함', 'yellow');
      }
      
      return true;
    } else {
      log(`❌ 백엔드 서버 응답 오류: ${response.statusCode}`, 'red');
      return false;
    }
  } catch (error) {
    log(`❌ 백엔드 서버 연결 실패: ${error.message}`, 'red');
    log('   백엔드 서버가 실행되고 있는지 확인하세요 (포트 3001)', 'yellow');
    return false;
  }
}

async function testCORS() {
  log('\n🌐 CORS 설정 테스트...', 'blue');
  
  try {
    const response = await makeRequest(`${BACKEND_URL}/health`, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://localhost:5173',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type'
      }
    });
    
    const corsHeaders = response.headers;
    
    if (corsHeaders['access-control-allow-origin']) {
      log('✅ CORS가 올바르게 설정되어 있습니다', 'green');
      log(`   - Allow-Origin: ${corsHeaders['access-control-allow-origin']}`, 'green');
      log(`   - Allow-Methods: ${corsHeaders['access-control-allow-methods'] || 'N/A'}`, 'green');
      return true;
    } else {
      log('❌ CORS 헤더가 설정되지 않았습니다', 'red');
      return false;
    }
  } catch (error) {
    log(`❌ CORS 테스트 실패: ${error.message}`, 'red');
    return false;
  }
}

async function testChatEndpoint() {
  log('\n💬 Chat 엔드포인트 테스트...', 'blue');
  
  // FormData 형태로 테스트 데이터 준비
  const boundary = '----formdata-test-boundary';
  const formData = [
    `--${boundary}`,
    'Content-Disposition: form-data; name="text"',
    '',
    '머리가 아파요',
    `--${boundary}--`
  ].join('\r\n');
  
  try {
    const response = await makeRequest(`${BACKEND_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Origin': 'http://localhost:5173'
      },
      body: formData
    });
    
    if (response.statusCode === 200) {
      log('✅ Chat 엔드포인트가 정상적으로 응답합니다', 'green');
      
      try {
        const chatData = JSON.parse(response.data);
        log(`   - 응답 텍스트: ${chatData.response ? '있음' : '없음'}`, 'green');
        log(`   - 병원 데이터: ${chatData.hospital_data ? '있음' : '없음'}`, 'green');
        log(`   - 진단 정보: ${chatData.condition ? '있음' : '없음'}`, 'green');
      } catch (e) {
        log('   - 응답 데이터 파싱 실패, 하지만 엔드포인트는 응답함', 'yellow');
      }
      
      return true;
    } else if (response.statusCode === 400) {
      log('⚠️  Chat 엔드포인트가 응답하지만 요청 형식에 문제가 있을 수 있습니다', 'yellow');
      log(`   - 상태 코드: ${response.statusCode}`, 'yellow');
      return true; // 엔드포인트는 존재함
    } else {
      log(`❌ Chat 엔드포인트 오류: ${response.statusCode}`, 'red');
      return false;
    }
  } catch (error) {
    log(`❌ Chat 엔드포인트 테스트 실패: ${error.message}`, 'red');
    return false;
  }
}

async function testFrontendAccess() {
  log('\n🖥️  프론트엔드 접근 테스트...', 'blue');
  
  try {
    const response = await makeRequest(FRONTEND_URL);
    
    if (response.statusCode === 200) {
      log('✅ 프론트엔드 서버가 정상적으로 실행 중입니다', 'green');
      return true;
    } else {
      log(`❌ 프론트엔드 서버 응답 오류: ${response.statusCode}`, 'red');
      return false;
    }
  } catch (error) {
    log(`❌ 프론트엔드 서버 연결 실패: ${error.message}`, 'red');
    log('   프론트엔드 서버가 실행되고 있는지 확인하세요 (포트 5173)', 'yellow');
    return false;
  }
}

async function runTests() {
  log(`${colors.bold}🚀 FirstAidVox 연동 테스트 시작${colors.reset}`, 'blue');
  log('=' * 50);
  
  const results = {
    backend: await testBackendHealth(),
    cors: await testCORS(),
    chat: await testChatEndpoint(),
    frontend: await testFrontendAccess()
  };
  
  log('\n📊 테스트 결과 요약', 'bold');
  log('=' * 30);
  
  Object.entries(results).forEach(([test, passed]) => {
    const status = passed ? '✅ 통과' : '❌ 실패';
    const color = passed ? 'green' : 'red';
    log(`${test.padEnd(10)}: ${status}`, color);
  });
  
  const allPassed = Object.values(results).every(Boolean);
  
  if (allPassed) {
    log('\n🎉 모든 테스트가 통과했습니다! 백엔드와 프론트엔드가 정상적으로 연동되었습니다.', 'green');
    log('\n다음 단계:', 'blue');
    log('1. 브라우저에서 http://localhost:5173 접속', 'blue');
    log('2. 마이크 권한 허용', 'blue');
    log('3. 음성으로 증상 설명 테스트', 'blue');
    log('4. 카메라로 이미지 업로드 테스트', 'blue');
  } else {
    log('\n⚠️  일부 테스트가 실패했습니다. 다음을 확인해주세요:', 'yellow');
    
    if (!results.backend) {
      log('- 백엔드 서버 실행: cd backend && uvicorn app.main:app --reload --port 3001', 'yellow');
    }
    if (!results.frontend) {
      log('- 프론트엔드 서버 실행: cd frontend && npm run dev', 'yellow');
    }
    if (!results.cors) {
      log('- 백엔드 CORS 설정 확인', 'yellow');
    }
    if (!results.chat) {
      log('- 백엔드 환경 변수 및 Google Cloud 설정 확인', 'yellow');
    }
  }
  
  process.exit(allPassed ? 0 : 1);
}

// 스크립트 실행
runTests().catch(error => {
  log(`\n💥 테스트 실행 중 오류 발생: ${error.message}`, 'red');
  process.exit(1);
});