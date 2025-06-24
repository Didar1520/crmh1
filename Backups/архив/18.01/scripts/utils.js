// scripts/utils.js

const sleep = require('util').promisify(setTimeout);

async function humanMouseMovements(page, duration = 2000) {
    let viewport = await page.viewport();
    if (!viewport) {
        console.error('Viewport is null. Устанавливаем значения по умолчанию.');
        await page.setViewport({ width: 1920, height: 1080 });
        viewport = await page.viewport();
        if (!viewport) {
            throw new Error('Не удалось установить viewport.');
        }
    }

    const { width, height } = viewport;

    const startX = Math.floor(Math.random() * width);
    const startY = Math.floor(Math.random() * height);

    await page.mouse.move(startX, startY);

    const startTime = Date.now();
    while (Date.now() - startTime < duration) {
        const randomX = startX + (Math.random() - 0.5) * 200;
        const randomY = startY + (Math.random() - 0.5) * 200;

        const steps = Math.floor(Math.random() * 8) + 5;
        await page.mouse.move(
            Math.max(0, Math.min(width, randomX)),
            Math.max(0, Math.min(height, randomY)),
            { steps }
        );
        await sleep(Math.random() * 100 + 50);
    }
}

async function clickWhenVisible(page, selector, interval = 2000) {
    const checkAndClick = async () => {
        try {
            const isVisible = await page.evaluate((selector) => {
                const element = document.querySelector(selector);
                return element && element.offsetParent !== null;
            }, selector);

            if (isVisible) {
                console.log(`Элемент "${selector}" найден и видим. Выполняем клик...`);
                await page.click(selector);
                return true;
            }
        } catch (error) {
            console.error(`Ошибка при проверке/клике элемента: ${error}`);
        }
        return false;
    };

    let clicked = false;
    while (!clicked) {
        clicked = await checkAndClick();
        if (!clicked) {
            await sleep(interval);
        }
    }
}

function waitForStateChange(conditionFn, interval = 2000, timeout = 30000) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();

        const checkInterval = setInterval(() => {
            if (conditionFn()) {
                clearInterval(checkInterval);
                resolve();
            } else if (Date.now() - startTime >= timeout) {
                clearInterval(checkInterval);
                reject(new Error('Timeout: условие не было выполнено за 30 секунд'));
            }
        }, interval);
    });
}

async function logActions(message, ws, status) {
    if (true) { // Здесь можно добавить условие из конфигурации, если требуется
        console.log(message);
        ws.send(JSON.stringify({ status: status, message: message }));
    } else {
        ws.send(JSON.stringify({ status: status, message: message }));
    }

    return true;
}

module.exports = {
    humanMouseMovements,
    clickWhenVisible,
    waitForStateChange,
    logActions,
    sleep,
};
