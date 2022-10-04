type None = null | undefined;

export class AlexaSmartPlugController {
    /**
     * @param force Pass true when you have issues with this function
     */
    public async getState(force?: boolean): Promise<boolean>

    /**
     * @param force Pass true when you have issues with this function
     */
    public async setState(value: boolean, force?: boolean): Promise<void>
}

export class AlexaSmartPlug {
    private constructor() {}

    public getId(): string
    public getName(): string
    public getDescription(): string
    public getAvailability(): 'AVAILABLE' // not sure what sentence might be set to availability, and what it used for

    public getController(): AlexaSmartPlugController

    public toString(): string
}

export default class AlexaController {
    public constructor(cookie: string | None, amazonDomain: string | None)

    // These can be changed, but I don't recommend doing it except for API changes
    // If these got changed, please submit PR
    public ROUTINES_VERSION = '3.0.128540';
    public SMARTHOME_SKILL_ID = 'amzn1.ask.1p.smarthome'; // cSpell:disable-line
    public API_PATH = {
        BEHAVIORS_ENTITIES: 'https://alexa.{AMAZON_DOMAIN}/api/behaviors/entities?skillId={SKILL_ID}',
        PHOENIX: 'https://alexa.{AMAZON_DOMAIN}/api/phoenix?includeRelationships=true',
        PHOENIX_STATE: 'https://alexa.{AMAZON_DOMAIN}/api/phoenix/state'
    };

    public async getAllDevices(): Promise<AlexaSmartPlug[]>
}
