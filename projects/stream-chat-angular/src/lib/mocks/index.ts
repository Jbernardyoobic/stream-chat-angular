import { DefaultUserType, StreamMessage } from '../types';
import { BehaviorSubject, ReplaySubject, Subject } from 'rxjs';
import { Channel, Event, EventTypes, UserResponse } from 'stream-chat';

export const mockCurrentUser = () =>
  ({
    id: 'currentUser',
    name: 'Bob',
    image: 'link/to/photo',
  } as UserResponse<DefaultUserType>);

export const mockMessage = () =>
  ({
    id: 'id',
    text: 'Hello from Angular SDK',
    user: mockCurrentUser(),
    type: 'regular',
    status: 'received',
    created_at: new Date('2021-09-14T13:08:30.004112Z'),
    readBy: [{ id: 'alice', name: 'Alice' }],
  } as any as StreamMessage);

const generateMockMessages = (offset = 0, isOlder = false) => {
  const messages = Array.from({ length: 25 }, (_, index) => {
    const message = mockMessage();
    message.created_at = new Date(
      message.created_at.getUTCMilliseconds() +
        (isOlder ? -1 : 1) * (index + offset)
    );
    message.id = (index + offset).toString();
    return message;
  });

  return messages;
};

export type MockChannel = Channel & {
  handleEvent: (name: EventTypes, payload?: any) => void;
};

export const generateMockChannels = (length = 25) => {
  const channels = Array.from({ length }, (_, index) => {
    const eventHandlers: { [key: string]: Function } = {};
    const channel = {
      cid: 'cid' + index.toString(),
      id: index.toString(),
      data: {
        id: index.toString(),
        name: `Channel${index}`,
        image: 'link/to/image',
      },
      on: (arg1: EventTypes | Function, handler: () => {}) => {
        eventHandlers[typeof arg1 === 'string' ? (arg1 as string) : 'on'] =
          handler || arg1;
        return { unsubscribe: () => {} };
      },
      watch: () => {},
      countUnread: () => {},
      handleEvent: (name: EventTypes, payload?: any) => {
        if (eventHandlers[name as string]) {
          eventHandlers[name as string]({ message: payload as StreamMessage });
        } else {
          eventHandlers['on'](payload);
        }
      },
      state: {
        messages: generateMockMessages(),
        read: {},
      },
      query: () => {
        return {
          messages: generateMockMessages(channel.state.messages.length),
        };
      },
      sendReaction: () => {},
      deleteReaction: () => {},
    } as any as MockChannel;
    return channel;
  });
  return channels;
};

export type MockChannelService = {
  hasMoreChannels$: Subject<boolean>;
  channels$: Subject<Channel[] | undefined>;
  activeChannelMessages$: BehaviorSubject<StreamMessage[]>;
  activeChannel$: Subject<Channel>;
  loadMoreMessages: () => void;
  loadMoreChannels: () => void;
  setAsActiveChannel: (c: Channel) => void;
};

export const mockChannelService = (): MockChannelService => {
  const messages = generateMockMessages();
  const activeChannelMessages$ = new BehaviorSubject<StreamMessage[]>(messages);
  const activeChannel$ = new BehaviorSubject<Channel>({
    id: 'channelid',
  } as Channel);
  const channels$ = new BehaviorSubject<Channel[] | undefined>(undefined);
  const hasMoreChannels$ = new ReplaySubject<boolean>(1);

  const loadMoreMessages = () => {
    const currentMessages = activeChannelMessages$.getValue();
    const messages = [
      ...generateMockMessages(currentMessages.length, true),
      ...currentMessages,
    ];
    activeChannelMessages$.next(messages);
  };

  const loadMoreChannels = () => {};
  const setAsActiveChannel = (channel: Channel) => {
    channel;
  };

  return {
    activeChannelMessages$,
    activeChannel$,
    loadMoreMessages,
    channels$,
    hasMoreChannels$,
    loadMoreChannels,
    setAsActiveChannel,
  };
};

export type MockStreamChatClient = {
  user: UserResponse;
  connectUser: jasmine.Spy;
  on: (name: EventTypes, handler: () => {}) => void;
  handleEvent: (name: EventTypes, event: Event) => void;
};

export const mockStreamChatClient = (): MockStreamChatClient => {
  const eventHandlers: { [key: string]: Function } = {};
  /* eslint-disable jasmine/no-unsafe-spy */
  const connectUser = jasmine.createSpy();
  /* eslint-enable jasmine/no-unsafe-spy */
  const user = mockCurrentUser();
  const on = (name: EventTypes, handler: () => {}) => {
    eventHandlers[name as string] = handler;
  };
  const handleEvent = (name: EventTypes, event: Event) => {
    eventHandlers[name as string](event);
  };

  return { connectUser, user, on, handleEvent };
};

export type Spied<T> = {
  [x in keyof T]: jasmine.Spy;
};
