// JSDoc type annotation
/**
 * @typedef {Object} RoomStore
 * @property {(roomId: string) => Promise<boolean>} roomExists
 * @property {(roomId: string) => Promise<{ roomId: string, playerCount: number, maxPlayers: number, isFull: boolean }|null>} getRoomPublicStatus
 * @property {(roomId: string) => Promise<object|null>} getRoomSnapshot
 * @property {(params: { socketId: string, playerName: string, worldType?: string, avatarModel?: string }) => Promise<{ createdPlayer: object, room: object }>} createRoom
 * @property {(params: { roomId: string, socketId: string, playerName: string, avatarModel?: string }) => Promise<{ player: object, room: object, isNewPlayer: boolean, systemMessage?: object }>} joinRoom
 * @property {(socketId: string) => Promise<object|null>} leaveRoom
 * @property {(params: { roomId: string, socketId: string, playerName: string, avatarModel?: string }) => Promise<{ departureObj: object|null, player: object, room: object, isNewPlayer: boolean, systemMessage?: object }>} moveSocketToRoom
 * @property {(socketId: string, nextState: object) => Promise<{ roomId: string, player: object }>} updatePlayerState
 * @property {(socketId: string, nextObjectState?: object) => Promise<{ roomId: string, object: object }>} updateWorldObjectState
 * @property {(socketId: string, text: string) => Promise<{ roomId: string, message: object, player: object }>} addChatMessage
 * @property {(socketId: string, commandPayload?: object) => Promise<{ roomId: string, watchTogether: object }>} applyWatchTogetherCommand
 * @property {(socketId: string) => Promise<string|null>} getRoomIdBySocket
 * @property {(() => Promise<void>)=} close
 */

export {};
