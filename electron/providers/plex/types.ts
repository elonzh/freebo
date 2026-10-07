export interface PlexStream {
  id: number;
  streamType: number;
  index?: number;
  languageCode?: string;
  displayTitle?: string;
  codec?: string;
  selected?: boolean | number;
  key?: string;
}
export interface PlexPart {
  id: number;
  key: string;
  duration?: number;
  Stream?: PlexStream[];
}
export interface PlexMedia {
  id: number;
  duration?: number;
  container?: string;
  videoResolution?: string;
  selected?: boolean | number;
  Part?: PlexPart[];
}
export interface PlexItem {
  ratingKey: string;
  key: string;
  title: string;
  type: string;
  grandparentTitle?: string;
  grandparentRatingKey?: string;
  duration?: number;
  viewOffset?: number;
  viewCount?: number;
  lastViewedAt?: number;
  playQueueItemID?: number;
  Media?: PlexMedia[];
}
export interface PlexContainer {
  MediaContainer: {
    Metadata?: PlexItem[];
    size?: number;
    offset?: number;
    totalSize?: number;
    playQueueID?: number;
    playQueueTotalCount?: number;
    playQueueSelectedItemID?: number;
    playQueueSelectedMetadataItemID?: string;
    machineIdentifier?: string;
    version?: string;
    friendlyName?: string;
  };
}
export interface PlexAuth {
  baseUrl: string;
  token: string;
  clientId: string;
  serverId?: string;
  playQueueId?: string;
  selectedQueueItemId?: string;
}
export interface PlexPlaybackData {
  metadata: PlexItem;
  mediaId: number;
  partIndex: number;
  offset: number;
}
