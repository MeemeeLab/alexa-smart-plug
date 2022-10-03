import COOKIE from "./index.config.js";
import AlexaController from "./../src/index.js";

const alexa = new AlexaController(COOKIE, 'amazon.co.jp');
const plugs = await alexa.getAllDevices();

const controller = plugs[0].getController();
console.log('now:', await controller.getState() ? 'on' : 'off');

console.log('set to:', 'on');
await controller.setState(true);

const afterOn = await controller.getState();
console.log('now:', afterOn ? 'on' : 'off');
if (!afterOn) {
    throw new Error('test failed');
}

setTimeout(async () => {
    console.log('set to:', 'off');
    await controller.setState(false);

    const afterOff = await controller.getState();
    console.log('now:', afterOff ? 'on' : 'off');
    if (afterOff) {
        throw new Error('test failed');
    }

    console.log('All OK!');
}, 5000);

