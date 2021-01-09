// @flow
import * as React from 'react';
import type { RecipeT, RecipeText, TagT, RecipeStatus, CommentT } from '../collections';
import type { Client, Collection } from '../../../packages/client-bundle';
import { useCollection, useItem } from '../../../packages/client-react';

import Button from '@material-ui/core/Button';
import { Route, Link, useRouteMatch, useParams, useHistory } from 'react-router-dom';
import IconButton from '@material-ui/core/IconButton';
import TextField from '@material-ui/core/TextField';
import EditIcon from '@material-ui/icons/Edit';
import Star from '@material-ui/icons/Star';
import StarOutline from '@material-ui/icons/StarOutline';
import { makeStyles } from '@material-ui/core/styles';
import deepEqual from '@birchill/json-equalish';
import renderQuill from './renderQuill';
import { imageUrl } from './utils';
import TagsEditor from './TagsEditor';

const Stars = ({ value, onChange }) => {
    return (
        <div>
            {[1, 2, 3, 4, 5].map((num) =>
                num <= value ? (
                    <Star
                        key={num}
                        style={{ cursor: 'pointer' }}
                        onClick={() => onChange(num === value ? null : num)}
                    />
                ) : (
                    <StarOutline
                        key={num}
                        style={{ cursor: 'pointer' }}
                        onClick={() => onChange(num)}
                    />
                ),
            )}
        </div>
    );
};

export const NewComment = ({
    recipe,
    col,
    actorId,
}: {
    recipe: RecipeT,
    col: Collection<RecipeT>,
    actorId: string,
}) => {
    const [text, setText] = React.useState(null);
    const [loading, setLoading] = React.useState(false);
    const [happiness, setHappiness] = React.useState(0);

    if (text == null) {
        return <Button onClick={() => setText('')}>Add comment</Button>;
    }

    return (
        <div style={{ padding: 8 }}>
            <Stars
                value={happiness}
                onChange={(value) => {
                    setHappiness(value == null ? 0 : value);
                }}
            />
            <div style={{ height: 16 }} />
            <TextField
                multiline
                fullWidth
                variant="outlined"
                label="Comment"
                placeholder="Write your comment"
                value={text}
                onChange={(evt) => setText(evt.target.value)}
            />
            <div style={{ height: 16 }} />
            <Button
                variant="contained"
                disabled={loading}
                style={{ marginRight: 16 }}
                onClick={async () => {
                    setLoading(true);
                    const id = col.genId();
                    await col.setAttribute(recipe.id, ['comments', id], {
                        id,
                        authorId: actorId,
                        text: { ops: [{ insert: text.trim() + '\n' }] },
                        date: Date.now(),
                        happiness,
                        images: [],
                    });
                    setText(null);
                    setHappiness(0);
                    setLoading(false);
                }}
            >
                Save
            </Button>
            <Button onClick={() => setText(null)}>Cancel</Button>
        </div>
    );
};

export const EditComment = ({
    comment,
    onSave,
    onCancel,
}: {
    comment: CommentT,
    onSave: (RecipeText, number, Array<string>) => mixed,
    onCancel: () => mixed,
}) => {
    const [text, setText] = React.useState(deltasToString(comment.text.ops).trim());
    const [happiness, setHappiness] = React.useState(comment.happiness);
    const [images, setImages] = React.useState<Array<string | Blob>>(comment.images.map((x) => x));

    return (
        <div style={{ padding: 8 }}>
            <Stars
                value={happiness}
                onChange={(value) => {
                    setHappiness(value == null ? 0 : value);
                }}
            />
            <div style={{ height: 16 }} />
            <TextField
                multiline
                fullWidth
                variant="outlined"
                label="Comment"
                placeholder="Write your comment"
                value={text}
                onChange={(evt) => setText(evt.target.value)}
            />
            <ImageUploader value={images} onChange={setImages} />
            <div style={{ height: 16 }} />
            <Button
                variant="contained"
                style={{ marginRight: 16 }}
                onClick={async () => {
                    onSave({ ops: [{ insert: text.trim() + '\n' }] }, happiness, []);
                }}
            >
                Save
            </Button>
            <Button onClick={() => onCancel()}>Cancel</Button>
        </div>
    );
};

const deltasToString = (ops) =>
    ops.map((op) => (typeof op.insert === 'string' ? op.insert : '')).join('');

const shrinkImage = (blob: Blob) => {
    const body = document.body;
    if (!body) {
        throw new Error('No body, cant shrink');
    }
    return new Promise((res, rej) => {
        setTimeout(() => rej(new Error('timeout')), 1000);
        console.log('shrinking', blob.size);
        var image = document.createElement('img');
        image.style.display = 'none';
        body.appendChild(image);
        image.onload = () => {
            var area = image.naturalWidth * image.naturalHeight;
            // shoot for 700k
            var resizeRatio = (0.7 * 1024 * 1024) / blob.size;
            var newArea = area * resizeRatio;
            var wToh = image.naturalWidth / image.naturalHeight;
            var newH = Math.sqrt(newArea / wToh);
            var newW = wToh * newH;
            var canvas = document.createElement('canvas');
            body.appendChild(canvas);
            canvas.style.display = 'none';
            canvas.width = newW;
            canvas.height = newH;
            var ctx = canvas.getContext('2d');
            ctx.drawImage(image, 0, 0, newW, newH);
            canvas.toBlob(
                (blob) => {
                    canvas.parentNode?.removeChild(canvas);
                    image.parentNode?.removeChild(image);
                    res(blob);
                },
                'image/jpeg',
                0.9,
            );
        };
        image.src = URL.createObjectURL(blob);
    });
};

const BlobImg = ({ src, ...props }) => {
    const url = React.useMemo(() => {
        if (typeof src === 'string') {
            return src;
        }
        return URL.createObjectURL(src);
    }, [src]);
    return <img {...props} src={url} />;
};

const oneMeg = 1024 * 1024;
const ensureSmallEnough = (blob) => {
    if (blob.size < oneMeg) {
        console.log(blob.size);
        return Promise.resolve(blob);
    } else {
        return shrinkImage(blob);
    }
};

const ImageUploader = ({ value, onChange }) => {
    return (
        <div>
            {value.map((item, i) => (
                <BlobImg
                    key={i}
                    src={item}
                    style={{
                        padding: 16,
                        width: 200,
                        objectFit: 'cover',
                        height: 200,
                    }}
                />
            ))}
            <input
                type="file"
                multiple
                onChange={async (evt) => {
                    console.log(evt.target.files);
                    const images = await Promise.all(
                        [...evt.target.files].map((blob) => ensureSmallEnough(blob)),
                    );
                    onChange(value.concat(images));
                }}
            />
        </div>
    );

    //   <input
    //     type_="file"
    //     style=(ReactDOMRe.Style.make(~visibility="hidden", ()))
    //     onChange=(evt => {
    //       let obj = ReactEvent.Form.target(evt) ;
    //       let files = obj##files;
    //       Js.log2("files", files);
    //       onChange(Array.append(images, Array.map(file => NotUploaded(file), files)));
    //       /* reduce(() => SetFiles(
    //         Array.append(state.objectUrls, Array.map(file => createObjectURL(file), files))
    //       ))(); */
    //       /* send( SetStatus(Preview)); */

    //     })
    //     multiple=true
    //     ref=?(state.triggerInput === None
    //     ? Some(ReactDOMRe.Ref.callbackDomRef((node) =>
    //          Js.Nullable.toOption(node)
    //         |> BaseUtils.optFold(
    //              (node) => send(SetTrigger(() => clickDom(node))),
    //              ()
    //            )))
    //     : None
    //     )
    //   />
    //   <button
    //     onClick=?{state.triggerInput |> BaseUtils.optMap(Utils.ignoreArg)}
    //     disabled=(state.triggerInput === None)
    //   >
    //     (str("Add Images"))
    //   </button>
};
