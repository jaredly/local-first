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
import Close from '@material-ui/icons/Close';
import StarOutline from '@material-ui/icons/StarOutline';
import { makeStyles } from '@material-ui/core/styles';
import deepEqual from '@birchill/json-equalish';
import renderQuill from './renderQuill';
import { imageUrl } from './utils';
import TagsEditor from './TagsEditor';

const Stars = ({ value, onChange }) => {
    const [hover, setHover] = React.useState(null);
    return (
        <div style={{ display: 'flex' }}>
            {[1, 2, 3, 4, 5].map((num) => (
                <div
                    onMouseEnter={() => setHover(num)}
                    style={{ cursor: 'pointer' }}
                    onMouseLeave={() =>
                        setTimeout(() => setHover((at) => (at === num ? null : at)), 50)
                    }
                    key={num}
                    onClick={() => onChange(num === value ? null : num)}
                >
                    {(hover != null ? num <= hover : num <= value) ? (
                        <Star color={hover != null ? 'primary' : undefined} />
                    ) : (
                        <StarOutline />
                    )}
                </div>
            ))}
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

const genId = () => Math.random().toString(36).slice(2);

export const EditComment = ({
    comment,
    onSave,
    onCancel,
    url,
}: {
    comment: CommentT,
    onSave: (RecipeText, number, Array<string>) => mixed,
    onCancel: () => mixed,
    url: string,
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
            <ImageUploader url={url} value={images} onChange={setImages} />
            <div style={{ height: 16 }} />
            <Button
                variant="contained"
                style={{ marginRight: 16 }}
                onClick={async () => {
                    const uploadedImages = await Promise.all(
                        images.map(async (image) => {
                            if (typeof image === 'string') {
                                return image;
                            }
                            const path = `images/${comment.id}/${genId()}.jpg`;
                            const res = await fetch(`${url}/uploads/${path}`, {
                                method: 'POST',
                                body: image,
                            });
                            if (res.status >= 300 || res.status < 200) {
                                console.log(new Error(`Failed to upload!`));
                                console.log(res.status);
                                console.log(await res.text());
                                return null;
                            }
                            // let id = BaseUtils.uuid();
                            //   let path = "images/" ++ recipeId ++ "/" ++ uid ++ "/" ++ madeItId ++ "/" ++ id ++ ".jpg";
                            //   Js.log3("Uploading", path, blob);
                            //   Firebase.Storage.get(Firebase.app(fb))
                            //   |> Firebase.Storage.ref
                            //   |> Firebase.Storage.child(path)
                            //   |> reff => withTimeout(Firebase.Storage.put(blob, reff), 30000)
                            //   |> Js.Promise.then_(snap => {
                            //     Js.log2("Uploaded!", path);
                            //     Js.Promise.resolve(Some(path))
                            //   })
                            //   |> Js.Promise.catch(err => {
                            //     Js.log3("error uploading image", path, err);
                            //     Js.Promise.resolve(None)
                            //   })
                            return `foood://${path}`;
                        }),
                    );
                    onSave(
                        { ops: [{ insert: text.trim() + '\n' }] },
                        happiness,
                        uploadedImages.filter((x) => x != null),
                    );
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

const BlobImg = ({ src, url, ...props }) => {
    const srcUrl = React.useMemo(() => {
        if (typeof src === 'string') {
            return imageUrl(src, url);
        }
        return URL.createObjectURL(src);
    }, [src]);
    return <img {...props} src={srcUrl} />;
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

const ImageUploader = ({ url, value, onChange }) => {
    const targetRef = React.useRef(null);
    return (
        <div style={{ marginTop: 16, marginBottom: 16 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                {value.map((item, i) => (
                    <div
                        key={i}
                        style={{
                            marginRight: 16,
                            marginBottom: 16,
                            position: 'relative',
                        }}
                    >
                        <BlobImg
                            src={item}
                            url={url}
                            style={{
                                width: 200,
                                objectFit: 'cover',
                                height: 200,
                            }}
                        />
                        <IconButton
                            style={{ position: 'absolute', top: 8, right: 8 }}
                            color="inherit"
                            onClick={() => {
                                onChange(value.filter((v) => v !== item));
                            }}
                        >
                            <Close />
                        </IconButton>
                    </div>
                ))}
            </div>
            <input
                type="file"
                multiple
                style={{ display: 'none' }}
                ref={(node) => (targetRef.current = node)}
                onChange={async (evt) => {
                    console.log(evt.target.files);
                    const images = await Promise.all(
                        [...evt.target.files].map((blob) => ensureSmallEnough(blob)),
                    );
                    onChange(value.concat(images));
                }}
            />
            <Button
                variant="outlined"
                onClick={() => {
                    targetRef.current?.click();
                }}
            >
                Add Images
            </Button>
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
