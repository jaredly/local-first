const { getTwoLevels } = require('./open-graph.js');
const fs = require('fs');

const data = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));

var rx = /https?:\/\/[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)?/gi;

const run = async () => {
    const news = (
        await Promise.all(
            data.children.map(async child => {
                const match = child.content.match(rx);
                if (!match) {
                    console.log('no url', child.content, child.children.length);
                    return;
                }
                const url = match[0];
                const without = child.content.replace(url, '').trim();
                const description = without.length ? without : null;

                const data = await getTwoLevels(url);

                return {
                    fetchedContent: data,
                    url,
                    description,
                    completed: child.completed,
                    added: child.created
                };
            })
        )
    ).filter(Boolean);
    fs.writeFileSync('./parsed.json', JSON.stringify(news, null, 2));
    console.log(news.length);
};
run().catch(console.error);
