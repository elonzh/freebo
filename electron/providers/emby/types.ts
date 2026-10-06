export interface MediaStream {
  Index: number;
  Type: "Video" | "Audio" | "Subtitle";
  Language?: string;
  DisplayTitle?: string;
  IsExternal?: boolean;
  DeliveryUrl?: string;
  Codec?: string;
}
export interface MediaSource {
  Id: string;
  Name?: string;
  Container?: string;
  Path?: string;
  Protocol?: string;
  MediaStreams?: MediaStream[];
  DefaultAudioStreamIndex?: number;
  DefaultSubtitleStreamIndex?: number;
  RunTimeTicks?: number;
  DirectStreamUrl?: string;
  SupportsDirectPlay?: boolean;
  SupportsDirectStream?: boolean;
  IsRemote?: boolean;
}
export interface MediaItem {
  Id: string;
  Name: string;
  Type: string;
  MediaType?: string;
  SeriesId?: string;
  SeasonId?: string;
  SeriesName?: string;
  IndexNumber?: number;
  ParentIndexNumber?: number;
  RunTimeTicks?: number;
  MediaSources?: MediaSource[];
  UserData?: {
    PlaybackPositionTicks?: number;
    Played?: boolean;
    PlayCount?: number;
    LastPlayedDate?: string;
  };
  PlaylistItemId?: string;
}
export interface PlaybackInfo {
  MediaSources: MediaSource[];
  PlaySessionId?: string;
  ErrorCode?: string;
}
export interface AuthContext {
  baseUrl: string;
  userId: string;
  token: string;
  deviceId: string;
  serverId?: string;
  clientName: string;
  clientVersion: string;
  deviceName: string;
}
