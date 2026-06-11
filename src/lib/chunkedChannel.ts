export const CHUNK_SIZE = 100 * 1024; // 100KB per chunk

export function wrapChannelWithChunking(channel: any) {
  const buffers: Record<string, string[]> = {};
  const listeners: Record<string, Function[]> = {};
  
  // Set up internal listener for chunked messages
  channel.on('broadcast', { event: 'chunked_message' }, (msg: any) => {
    const { chunkId, index, total, event, data } = msg.payload;
    if (!buffers[chunkId]) {
      buffers[chunkId] = new Array(total);
    }
    buffers[chunkId][index] = data;

    // Check if fully received
    let complete = true;
    for (let i = 0; i < total; i++) {
      if (buffers[chunkId][i] === undefined) {
        complete = false;
        break;
      }
    }

    if (complete) {
      const fullStr = buffers[chunkId].join('');
      delete buffers[chunkId];
      try {
        const fullPayload = JSON.parse(fullStr);
        // Dispatch to registered listeners
        const cbs = listeners[event] || [];
        cbs.forEach((cb) => cb({ payload: fullPayload }));
      } catch (e) {
        console.error('Error parsing assembled chunked payload', e);
      }
    }
  });

  const wrapper = {
    _channel: channel,
    send: (msg: any) => {
      const payloadStr = JSON.stringify(msg.payload);
      if (payloadStr.length <= CHUNK_SIZE) {
        return channel.send(msg); // Send normally
      }

      // Chunk it
      const event = msg.event;
      const totalChunks = Math.ceil(payloadStr.length / CHUNK_SIZE);
      const chunkId = crypto.randomUUID();
      
      const sendChunks = async () => {
        const results = [];
        for (let i = 0; i < totalChunks; i++) {
          const chunkData = payloadStr.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
          const p = channel.send({
            type: 'broadcast',
            event: 'chunked_message',
            payload: {
              chunkId,
              index: i,
              total: totalChunks,
              event: event,
              data: chunkData
            }
          });
          results.push(await p);
          await new Promise(resolve => setTimeout(resolve, 20));
        }
        return results;
      };
      
      return sendChunks();
    },
    on: (type: string, filter: any, callback: Function) => {
      const event = filter.event;
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(callback);
      
      // Also listen natively for non-chunked messages
      channel.on(type, filter, callback);
      return wrapper;
    },
    subscribe: (callback?: any) => channel.subscribe(callback),
    unsubscribe: () => channel.unsubscribe()
  };

  return wrapper;
}
