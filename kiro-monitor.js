#!/usr/bin/env node
/**
 * Kiro Activity Monitor
 * 监控Kiro的日志文件，自动向Vibe Process Bar发送状态通知
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');

const VIBE_API = 'http://localhost:31415';
const POLL_INTERVAL = 1000; // 1秒检查一次

// Kiro日志目录
const KIRO_LOGS_DIR = path.join(os.homedir(), 'Library/Application Support/Kiro/logs');

let currentTaskId = null;
let lastActivityTime = 0;
let isTaskRunning = false;
let lastLogSize = 0;
let lastLogContent = '';

// 发送HTTP请求
function sendRequest(endpoint, data) {
    return new Promise((resolve, reject) => {
        const url = new URL(endpoint, VIBE_API);
        const postData = JSON.stringify(data);
        
        const req = http.request({
            hostname: url.hostname,
            port: url.port,
            path: url.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        }, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => resolve(body));
        });
        
        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

// 开始任务
async function startTask() {
    if (isTaskRunning) return;
    
    currentTaskId = `kiro_${Date.now()}`;
    isTaskRunning = true;
    
    try {
        await sendRequest('/api/task/start', {
            task_id: currentTaskId,
            name: 'Kiro AI Task',
            ide: 'Kiro',
            window_title: 'vibeProcessBarExtension'
        });
        console.log(`[${new Date().toISOString()}] Task started: ${currentTaskId}`);
    } catch (err) {
        console.error('Failed to start task:', err.message);
    }
}

// 结束任务
async function completeTask() {
    if (!isTaskRunning) return;
    
    try {
        await sendRequest('/api/task/complete', {
            task_id: currentTaskId,
            total_tokens: 0
        });
        console.log(`[${new Date().toISOString()}] Task completed: ${currentTaskId}`);
    } catch (err) {
        console.error('Failed to complete task:', err.message);
    }
    
    isTaskRunning = false;
    currentTaskId = null;
}

// 获取最新的日志目录
function getLatestLogDir() {
    try {
        const dirs = fs.readdirSync(KIRO_LOGS_DIR)
            .filter(d => /^\d{8}T\d{6}$/.test(d))
            .sort()
            .reverse();
        
        if (dirs.length > 0) {
            return path.join(KIRO_LOGS_DIR, dirs[0]);
        }
    } catch (err) {
        // ignore
    }
    return null;
}

// 查找exthost日志
function findExthostLog(logDir) {
    try {
        // 查找window目录
        const items = fs.readdirSync(logDir);
        for (const item of items) {
            if (item.startsWith('window')) {
                const exthostDir = path.join(logDir, item, 'exthost');
                if (fs.existsSync(exthostDir)) {
                    const exthostLog = path.join(exthostDir, 'exthost.log');
                    if (fs.existsSync(exthostLog)) {
                        return exthostLog;
                    }
                }
            }
        }
    } catch (err) {
        // ignore
    }
    return null;
}

// 检查日志活动
function checkLogActivity() {
    const logDir = getLatestLogDir();
    if (!logDir) return;
    
    const exthostLog = findExthostLog(logDir);
    if (!exthostLog) return;
    
    try {
        const stats = fs.statSync(exthostLog);
        const currentSize = stats.size;
        
        // 如果日志文件变大了，说明有活动
        if (currentSize > lastLogSize) {
            // 读取新增的内容
            const fd = fs.openSync(exthostLog, 'r');
            const buffer = Buffer.alloc(currentSize - lastLogSize);
            fs.readSync(fd, buffer, 0, buffer.length, lastLogSize);
            fs.closeSync(fd);
            
            const newContent = buffer.toString();
            
            // 检测AI活动关键词
            if (newContent.includes('kiroAgent') || 
                newContent.includes('anthropic') ||
                newContent.includes('claude') ||
                newContent.includes('streaming') ||
                newContent.includes('completion')) {
                
                lastActivityTime = Date.now();
                
                if (!isTaskRunning) {
                    startTask();
                }
            }
            
            lastLogSize = currentSize;
        }
        
        // 如果超过5秒没有活动，认为任务结束
        if (isTaskRunning && Date.now() - lastActivityTime > 5000) {
            completeTask();
        }
        
    } catch (err) {
        // ignore
    }
}

// 主循环
console.log('Kiro Activity Monitor started');
console.log(`Monitoring: ${KIRO_LOGS_DIR}`);
console.log(`Sending to: ${VIBE_API}`);
console.log('Press Ctrl+C to stop\n');

setInterval(checkLogActivity, POLL_INTERVAL);

// 优雅退出
process.on('SIGINT', async () => {
    console.log('\nShutting down...');
    if (isTaskRunning) {
        await completeTask();
    }
    process.exit(0);
});
