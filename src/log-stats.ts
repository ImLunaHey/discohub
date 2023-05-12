import { globalLogger } from '@app/logger';

const logger = globalLogger.child({ service: 'DiscoHub' });

export const logStats = () => {
    try {
        const memoryData = process.memoryUsage();
        const memoryUsage = {
            rss: memoryData.rss, // -> Resident Set Size - total memory allocated for the process execution`,
            heapTotal: memoryData.heapTotal, // -> total size of the allocated heap`,
            heapUsed: memoryData.heapUsed, // -> actual memory used during the execution`,
            external: memoryData.external, // -> V8 external memory`,
        };
        logger.info('Memory usage', { memoryUsage });
    } catch { }
};