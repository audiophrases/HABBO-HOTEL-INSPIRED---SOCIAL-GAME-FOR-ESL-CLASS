import { Schema, type, MapSchema } from "@colyseus/schema";

export class Player extends Schema {
    @type("number") x: number = 400;
    @type("number") y: number = 300;
    @type("string") username: string = "";
    @type("number") skin: number = 0;
    @type("number") hairColor: number = 0;
    @type("number") hair: number = 0;
    @type("number") eyes: number = 0;
    @type("number") mouth: number = 0;
    @type("number") shirt: number = 0;
    @type("number") glasses: number = 0;
    @type("number") hat: number = 0;
}

export class ChatMessage extends Schema {
    @type("string") sender: string = "";
    @type("string") text: string = "";
    @type("number") timestamp: number = 0;
}

export class LobbyState extends Schema {
    @type({ map: Player }) players = new MapSchema<Player>();
}
