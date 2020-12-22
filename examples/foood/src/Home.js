// @flow
import * as React from 'react';
import type { RecipeT } from '../collections';
import type { Client, Collection } from '../../../packages/client-bundle';
import { useCollection, useItem } from '../../../packages/client-react';
import { Route, Link, useRouteMatch, useParams } from 'react-router-dom';

// TODO: list all *tags*, based on stuff.
// Include a url for importing if you want to be fast
// Also a search bar
// Have foood register itself as a share target too.

// Am I ready for bulk import?
// Seems like I might be.

const Home = ({
    // col,
    // recipes,
    client,
}: {
    // col: Collection<RecipeT>,
    client: Client<*>,
    // recipes: { [key: string]: RecipeT },
}) => {
    const match = useRouteMatch();
    const [col, recipes] = useCollection(React, client, 'recipes');
    const [tagsCol, tags] = useCollection(React, client, 'tags');

    if (match.params.tagid) {
        const matches = Object.keys(recipes).filter((id) =>
            recipes[id].tags ? recipes[id].tags[match.params.tagid] != null : false,
        );
        return (
            <div>
                Recipes!!
                {Object.keys(tags).map((id) => (
                    <div>{tags[id].text}</div>
                ))}
                {matches.map((id) => (
                    <div>
                        {recipes[id].title}
                        {recipes[id].contents.totalTime}
                        {recipes[id].status}
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div>
            Recipes!!
            {Object.keys(tags).map((id) => (
                <div>
                    <Link to={'/tag/' + id}>{tags[id].text}</Link>
                </div>
            ))}
            {Object.keys(recipes).map((id) => (
                <div>
                    {recipes[id].title}
                    {recipes[id].contents.totalTime}
                    {recipes[id].status}
                </div>
            ))}
        </div>
    );
};

export default Home;
