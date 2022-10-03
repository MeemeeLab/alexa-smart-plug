# alexa-smart-plug
## A library to control alexa smart plugs

## Installation
### Session cookie
You'll need session cookie first.\
Simply go to `alexa.amazon.com` or something like `alexa.amazon.co.jp` depending on your geolocation.\
After that, login to your amazon account then open DevTools (F12).\
Go to network tab and click top one.\
Scroll down to request headers, and find `cookie` value. This is your session cookie.\
Don't forget to copy all. It might have newline because of it's size.

For example, this is the network tab of chrome DevTools:\
![](https://i.imgur.com/qwuGUxC.png)

And finally, you have to pass session information by first argument of AlexaController.\
Simply pass it or set `ALEXA_SMARTPLUG_COOKIE` environment.

### Amazon domain
You'll need the amazon domain, like `amazon.com` and `amazon.co.jp`.

Pass it on second argument of AlexaController, or use `ALEXA_SMARTPLUG_AMAZON_DOMAIN` environment.

### And, finally install library
`npm i alexa-smart-plug`

## How do I use this
Take a look at [test/index.js](https://github.com/MeemeeLab/alexa-smart-plug/blob/main/test/index.js) file.\
For type definition, look at [src/index.d.ts](https://github.com/MeemeeLab/alexa-smart-plug/blob/main/src/index.d.ts).
