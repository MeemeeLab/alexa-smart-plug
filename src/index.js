import fetch from 'node-fetch';
import { inspect } from 'util';
import https from 'https';
import dns from 'dns';

class UnAuthenticatedError extends Error {
    constructor() { super(); }
    name = 'UnAuthenticatedError';
    message = 'No cookie provided.';
}

class NoAmazonDomainError extends Error {
    constructor() { super(); }
    name = 'NoAmazonDomainError';
    message = 'No amazon domain provided.';
}

class OptionError extends Error {
    constructor( message ) { super(); this.message = message; }
    name = 'OptionError';
}

class UnknownStateError extends Error {
    constructor(help) {
        if (help) {
            this.message = 'alexa-smart-plug detected unknown error. Try ' + help + '\nIf this keeps happening, please submit issue with logs attached.'
        }
    }
    message = 'alexa-smart-plug detected unknown error. Please submit issue with logs attached.';
}

class AlexaController {
    static log = process.env['ALEXA_SMARTPLUG_ENABLE_LOG'] !== undefined ? (...args) => { console.log(...args.map(arg => inspect(arg, { depth: Infinity }))); return args[1]; } : (...args) => args[1];
    _processDevices(jsonResponse) {
        const devices = [];

        for (const device of jsonResponse) {
            if (device.providerData.deviceType === 'SMARTPLUG') { // cSpell:disable-line
                AlexaController.log('_processDevices', 'Found smart plug at ' + device.id + ' (' + device.displayName + ')!');
                devices.push(new AlexaSmartPlug(this, {
                    _id: device.id,
                    _name: device.displayName,
                    _description: device.description,
                    _availability: device.availability
                }));
            }
        }

        return devices;
    }

    static _cachedNetworkDetails = []; // used in AlexaSmartPlugController

    constructor(cookie, amazonDomain, options) {
        if (cookie === undefined) {
            // cSpell:disable-next-line
            if (process.env['ALEXA_SMARTPLUG_COOKIE'] !== undefined) {
                cookie = process.env['ALEXA_SMARTPLUG_COOKIE']; // cSpell:disable-line
            } else {
                throw new UnAuthenticatedError();
            }
        }
        this._cookie = cookie;

        if (amazonDomain === undefined) {
            // cSpell:disable-next-line
            if (process.env['ALEXA_SMARTPLUG_AMAZON_DOMAIN'] !== undefined) {
                cookie = process.env['ALEXA_SMARTPLUG_AMAZON_DOMAIN']; // cSpell:disable-line
            } else {
                throw new NoAmazonDomainError();
            }
        }
        this._amazonDomain = amazonDomain;

        this.SMARTHOME_SKILL_ID = 'amzn1.ask.1p.smarthome'; // cSpell:disable-line
        this.API_PATH = {
            BEHAVIORS_ENTITIES: 'https://alexa.{AMAZON_DOMAIN}/api/behaviors/entities?skillId={SKILL_ID}',
            PHOENIX: 'https://alexa.{AMAZON_DOMAIN}/api/phoenix?includeRelationships=true',
            PHOENIX_STATE: 'https://alexa.{AMAZON_DOMAIN}/api/phoenix/state'
        };

        if (options) {
            if (options.agent && options.alexaIP) {
                throw new OptionError('Cannot specify options.agent and options.alexaIP in same instance');
            }

            if (options.agent) {
                this.agent = options.agent;
            }
            if (options.alexaIP) {
                const agent = new https.Agent({
                    lookup: async (host, _, cb) => {
                        if (host === 'alexa.' + amazonDomain) {
                            cb(null, options.alexaIP, 4);
                        } else {
                            cb(null, (await dns.promises.resolve(host))[0], 4);
                        }
                    }
                });
                this.agent = agent;
            }
        }
    }

    async _fetch(url, init = {}) {
        if (init === undefined) init = {};
        init.agent = this.agent;
        if (init.headers === undefined) init.headers = {};
        init.headers['User-Agent'] = 'PitanguiBridge/2.2.479076.0-[PLATFORM=Android][MANUFACTURER=][RELEASE=10][BRAND=][SDK=29][MODEL=]';
        if (init.headers.Cookie === undefined) {
            init.headers.Cookie = this._cookie;
        } else {
            init.headers.Cookie = init.headers.cookie + '; ' + this._cookie;
        }

        return await fetch(url, init);
    }

    async getAllDevices() {
        // cSpell:disable-next-line
        return await this._fetch(
            this.API_PATH.BEHAVIORS_ENTITIES
                .replaceAll('{AMAZON_DOMAIN}', this._amazonDomain)
                .replaceAll('{SKILL_ID}', this.SMARTHOME_SKILL_ID))
            .then(resp => resp.json())
            .then(resp => AlexaController.log('getAllDevices', resp))
            .then(resp => this._processDevices(resp));
    }
}

class AlexaSmartPlug {
    constructor(caller, params) {
        Object.assign(this, params);
        this._controller = new AlexaSmartPlugController(caller, this);
    }

    getId() { return this._id }
    getName() { return this._name }
    getDescription() { return this._description }
    getAvailability() { return this._availability }

    getController() { return this._controller }

    toString() {
        return this.getName();
    }
}

class AlexaSmartPlugControllerInteractionError extends Error {
    constructor(message) {
        super();
        this.message = 'Interaction failed: ' + message;
    }
}

class AlexaSmartPlugController {
    async _getNetworkDetail(force) {
        if (force) {
            return await this._parentController._fetch(
                this._parentController.API_PATH.PHOENIX
                    .replaceAll('{AMAZON_DOMAIN}', this._parentController._amazonDomain))
                .then(resp => resp.json())
                .then(resp => JSON.parse(resp.networkDetail))
                .then(resp => AlexaController.log('_getNetworkDetail', resp))
        } else {
            if (this._parentController._cachedNetworkDetails !== undefined) {
                return this._parentController._cachedNetworkDetails;
            } else {
                const resp = await this._getNetworkDetail(true);
                this._parentController._cachedNetworkDetails = resp;
                return resp;
            }
        }
    }

    async _getApplianceIdFromEntityId(entityId, force) {
        // maybe there's better way to do this
        const networkDetail = await this._getNetworkDetail(force);
        const applianceDetails = networkDetail.locationDetails.locationDetails.Default_Location
            .amazonBridgeDetails.amazonBridgeDetails['LambdaBridge_AAA/SonarCloudService'].applianceDetails.applianceDetails;

        if (!applianceDetails) {
            throw new UnknownStateError();
        }
        
        for (const key in applianceDetails) {
            const applianceDetail = applianceDetails[key];

            if (applianceDetail.entityId === entityId) {
                return applianceDetail.applianceId;
            }
        }

        return null;
    }

    constructor(parentController, plug) {
        this._parentController = parentController,
        this.plug = plug;
    }

    async setState(value) {
        // const applianceId = await this._getApplianceIdFromEntityId(this.plug.getId(), force);

        // if (applianceId === undefined) {
        //     throw new UnknownStateError('passing true on force parameter on setState');
        // }

        const action = value ? 'turnOn' : 'turnOff';

        const payload = {
            controlRequests: [{
                entityId: this.plug.getId(),
                entityType: 'APPLIANCE',
                parameters: {
                    action: action
                }
            }]
        };

        const response = await this._parentController._fetch(
            this._parentController.API_PATH.PHOENIX_STATE
                .replaceAll('{AMAZON_DOMAIN}', this._parentController._amazonDomain),
            {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            })
            .then(resp => resp.json())
            .then(resp => AlexaController.log('setState', resp));
        
        if (response.errors.length !== 0) {
            throw new AlexaSmartPlugControllerInteractionError(response.errors[0].message);
        }
    }

    async getState(force) {
        const applianceId = await this._getApplianceIdFromEntityId(this.plug.getId(), force);

        if (applianceId === undefined) {
            throw new UnknownStateError('passing true on force parameter on getState');
        }

        const payload = {
            stateRequests: [{
                entityId: applianceId, // looks wrong, but actually it's not
                entityType: 'APPLIANCE'
            }]
        };

        const response = await this._parentController._fetch(
            this._parentController.API_PATH.PHOENIX_STATE
                .replaceAll('{AMAZON_DOMAIN}', this._parentController._amazonDomain),
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            })
            .then(resp => resp.json())
            .then(resp => AlexaController.log('getState', resp));
        
        if (response.errors.length !== 0) {
            throw new AlexaSmartPlugControllerInteractionError(response.errors[0].message);
        }

        const capabilityStates = response.deviceStates[0].capabilityStates.map(v => JSON.parse(v));
        return capabilityStates.find(v => v.namespace === 'Alexa.PowerController').value === 'ON' ? true : false;
    }
}

export default AlexaController;
export { AlexaController, AlexaSmartPlug, AlexaSmartPlugController, UnAuthenticatedError, NoAmazonDomainError, UnknownStateError, AlexaSmartPlugControllerInteractionError }
