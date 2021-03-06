import { AudioActionType, audioRef, audioStatePubSub, currentTimePubSub } from "../utils/audiomodule.js";
import { appContext, ChangBits } from "./app.context.js";
import { LrcAudio } from "./audio.js";
import { LoadAudio, nec } from "./loadaudio.js";
import { toastPubSub } from "./toast.js";

const { useCallback, useContext, useEffect, useReducer, useRef } = React;

export const Footer: React.FC = () => {
    // tslint:disable-next-line: no-bitwise
    const { prefState, lang } = useContext(appContext, ChangBits.lang | ChangBits.builtInAudio);

    const [audioSrc, setAudioSrc] = useReducer(
        (oldSrc: string, newSrc: string) => {
            URL.revokeObjectURL(oldSrc);
            return newSrc;
        },
        undefined,
        () => {
            let src = sessionStorage.getItem(SSK.audioSrc);
            if (src === null && location.search && URLSearchParams) {
                const searchParams = new URLSearchParams(location.search);
                const url = searchParams.get("url");
                if (url !== null) {
                    return url;
                }
                const text = searchParams.get("text") || searchParams.get("title");
                const result = /https?:\/\/\S+/.exec(text!);
                src = result && nec(result[0]);
            }
            return src!;
        },
    );

    useEffect(() => {
        document.addEventListener("keydown", (ev) => {
            const { code, key, target } = ev;

            const codeOrKey = code || key;

            if (["text", "textarea", "url"].includes((target as any).type as string)) {
                return;
            }

            const ac = audioRef.current!;

            if (!ac.src) {
                return;
            }

            if (ev.metaKey === true || ev.ctrlKey === true) {
                if (["ArrowUp", "KeyJ", "Up", "J", "j"].includes(codeOrKey)) {
                    ev.preventDefault();

                    const rate = ac.playbackRate;
                    const newRate = Math.exp(Math.min(Math.log(rate) + 0.2, 1));

                    ac.playbackRate = newRate;
                } else if (["ArrowDown", "KeyK", "Down", "K", "k"].includes(codeOrKey)) {
                    ev.preventDefault();

                    const rate = ac.playbackRate;
                    const newRate = Math.exp(Math.max(Math.log(rate) - 0.2, -1));

                    ac.playbackRate = newRate;
                } else if (codeOrKey === "Enter") {
                    ev.preventDefault();
                    audioRef.toggle();
                }
            } else {
                if (["ArrowLeft", "KeyA", "KeyH", "Left", "A", "a", "H", "h"].includes(codeOrKey)) {
                    ev.preventDefault();

                    ac.currentTime -= 5;
                } else if (["ArrowRight", "KeyD", "KeyL", "Right", "D", "d", "L", "l"].includes(codeOrKey)) {
                    ev.preventDefault();

                    ac.currentTime += 5;
                } else if (code === "KeyR" || key === "R" || key === "r") {
                    ev.preventDefault();

                    ac.playbackRate = 1;
                }
            }
        });
    }, []);

    useEffect(() => {
        document.documentElement.addEventListener("drop", (ev) => {
            const file = ev.dataTransfer!.files[0];
            receiveFile(file, setAudioSrc);
        });
    }, []);

    const onAudioInputChange = useCallback((ev: React.ChangeEvent<HTMLInputElement>) => {
        const file = ev.target.files![0];
        receiveFile(file, setAudioSrc);
    }, []);

    const rafId = useRef(0);

    const onAudioLoadedMetadata = useCallback(() => {
        cancelAnimationFrame(rafId.current);
        audioStatePubSub.pub({
            type: AudioActionType.getDuration,
            payload: audioRef.duration,
        });
        toastPubSub.pub({
            type: "success",
            text: lang.notify.audioLoaded,
        });
    }, [lang]);

    const syncCurrentTime = useCallback(() => {
        currentTimePubSub.pub(audioRef.currentTime);
        rafId.current = requestAnimationFrame(syncCurrentTime);
    }, []);

    const onAudioPlay = useCallback(() => {
        rafId.current = requestAnimationFrame(syncCurrentTime);
        audioStatePubSub.pub({
            type: AudioActionType.pause,
            payload: false,
        });
    }, []);

    const onAudioPause = useCallback(() => {
        cancelAnimationFrame(rafId.current);
        audioStatePubSub.pub({
            type: AudioActionType.pause,
            payload: true,
        });
    }, []);

    const onAudioEnded = useCallback(() => {
        cancelAnimationFrame(rafId.current);
        audioStatePubSub.pub({
            type: AudioActionType.pause,
            payload: true,
        });
    }, []);

    const onAudioTimeUpdate = useCallback(() => {
        if (audioRef.paused) {
            currentTimePubSub.pub(audioRef.currentTime);
        }
    }, []);

    const onAudioRateChange = useCallback(() => {
        audioStatePubSub.pub({
            type: AudioActionType.rateChange,
            payload: audioRef.playbackRate,
        });
    }, []);

    const onAudioError = useCallback((ev) => {
        toastPubSub.pub({
            type: "warning",
            text: (ev.target as HTMLAudioElement).error!.message,
        });
    }, []);

    return (
        <footer className="app-footer">
            <input id="audio-input" type="file" accept="audio/*, .ncm" hidden={true} onChange={onAudioInputChange} />
            <LoadAudio setAudioSrc={setAudioSrc} lang={lang} />
            <audio
                ref={audioRef}
                src={audioSrc}
                controls={prefState.builtInAudio}
                hidden={!prefState.builtInAudio}
                onLoadedMetadata={onAudioLoadedMetadata}
                onPlay={onAudioPlay}
                onPause={onAudioPause}
                onEnded={onAudioEnded}
                onTimeUpdate={onAudioTimeUpdate}
                onRateChange={onAudioRateChange}
                onError={onAudioError}
            />
            {prefState.builtInAudio || <LrcAudio lang={lang} />}
        </footer>
    );
};

type TsetAudioSrc = (src: string) => void;

const receiveFile = (file: File, setAudioSrc: TsetAudioSrc) => {
    sessionStorage.removeItem(SSK.audioSrc);

    if (file) {
        if (file.type.startsWith("audio/")) {
            setAudioSrc(URL.createObjectURL(file));
            return;
        }
        if (file.name.endsWith(".ncm")) {
            const worker = new Worker("./ncmc-worker.js");
            worker.addEventListener(
                "message",
                (ev) => {
                    if (ev.data.type === "url") {
                        const { dataArray, mime } = ev.data;
                        const musicFile = new Blob([dataArray], {
                            type: mime,
                        });

                        setAudioSrc(URL.createObjectURL(musicFile));
                    }
                    if (ev.data.type === "error") {
                        toastPubSub.pub({
                            type: "warning",
                            text: ev.data.data,
                        });
                    }
                },
                { once: true },
            );

            worker.addEventListener(
                "error",
                (ev) => {
                    toastPubSub.pub({
                        type: "warning",
                        text: ev.message,
                    });
                    worker.terminate();
                },
                { once: true },
            );

            worker.postMessage(file);

            return;
        }
    }
};

// side effect
document.addEventListener("visibilitychange", () => {
    if (!audioRef.paused) {
        audioRef.toggle();
    }
});
