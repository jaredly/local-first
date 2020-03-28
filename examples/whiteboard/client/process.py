import json
text = open('./uihi.txt').read().split('\n')[1:]

repeated = text[0:4]

cards = []
pending = []
def make_card(pending):
    return {'title': pending[0], 'description': ' '.join(pending[1:])}

for line in text[9:]:
    if line in repeated: continue
    if line.endswith(':'):
        if len(pending):
            cards.append(make_card(pending))
        pending = [line[:-1]]
    else:
        pending.append(line)
if len(pending):
    cards.append(make_card(pending))

open('./data.json', 'w').write(json.dumps(cards, indent=2))

