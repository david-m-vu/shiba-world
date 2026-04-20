import CloseIcon from "../assets/icons/close.svg?react";

const CREDITS = [
    {
        id: "icon-shiba-inu",
        title: "Shiba inu icon",
        sourceUrl: "https://www.flaticon.com/free-icons/shiba-inu",
        sourceLabel: "Flaticon",
        authorName: "Paul J.",
        authorUrl: "https://www.flaticon.com/authors/paul-j",
        licenseName: "Flaticon License",
        licenseUrl: "https://www.flaticon.com/legal",
    },
    {
        id: "model-shiba",
        title: "Shiba",
        sourceUrl: "https://sketchfab.com/3d-models/shiba-faef9fe5ace445e7b2989d1c1ece361c",
        sourceLabel: "Sketchfab",
        authorName: "zixisun02",
        authorUrl: "https://sketchfab.com/zixisun51",
        licenseName: "CC-BY-4.0",
        licenseUrl: "http://creativecommons.org/licenses/by/4.0/",
    },
    {
        id: "model-black-shiba",
        title: "ShibaTexturingChallenge (Black Shiba)",
        sourceUrl: "https://sketchfab.com/3d-models/shibatexturingchallenge-0566573fdc5845ee99822c656e60c253",
        sourceLabel: "Sketchfab",
        authorName: "Elbolillo",
        authorUrl: "https://sketchfab.com/Elbolilloduro",
        licenseName: "CC-BY-4.0",
        licenseUrl: "http://creativecommons.org/licenses/by/4.0/",
    },
    {
        id: "model-bodyguard-shiba",
        title: "Bodyguard Shiba",
        sourceUrl: "https://sketchfab.com/3d-models/bodyguard-shiba-7ebaaf4347034c35a7a5aa83919c2ca3",
        sourceLabel: "Sketchfab",
        authorName: "Peixe do Blender",
        authorUrl: "https://sketchfab.com/PeixedoBlender",
        licenseName: "CC-BY-4.0",
        licenseUrl: "http://creativecommons.org/licenses/by/4.0/",
    },
    {
        id: "model-constellation-shiba",
        title: "Constellation Shiba",
        sourceUrl: "https://sketchfab.com/3d-models/constellation-shiba-df20a205f05a4878a24ffd72d745bde6",
        sourceLabel: "Sketchfab",
        authorName: "Elpiedras",
        authorUrl: "https://sketchfab.com/Elpiedras",
        licenseName: "CC-BY-4.0",
        licenseUrl: "http://creativecommons.org/licenses/by/4.0/",
    },
    // {
    //     id: "model-astro-shiba",
    //     title: "Mars Mission Specialist Nugget (Astro Shiba)",
    //     sourceUrl: "https://sketchfab.com/3d-models/mars-mission-specialist-nugget-d65c0d7241fb4315ba15de17a84f8b36",
    //     sourceLabel: "Sketchfab",
    //     authorName: "lulu9green",
    //     authorUrl: "https://sketchfab.com/lulu9green",
    //     licenseName: "CC-BY-4.0",
    //     licenseUrl: "http://creativecommons.org/licenses/by/4.0/",
    // },
    {
        id: "model-just-a-girl",
        title: "Just a Girl",
        sourceUrl: "https://sketchfab.com/3d-models/just-a-girl-b2359160a4f54e76b5ae427a55d9594d",
        sourceLabel: "Sketchfab",
        authorName: "腱鞘炎の人",
        authorUrl: "https://sketchfab.com/Kensyouen",
        licenseName: "CC-BY-4.0",
        licenseUrl: "http://creativecommons.org/licenses/by/4.0/",
    },
    {
        id: "model-golden-gate-bridge",
        title: "Golden Gate Bridge",
        sourceUrl: "https://sketchfab.com/3d-models/golden-gate-bridge-a0ee5a9c285849c0819af5f366be3835",
        sourceLabel: "Sketchfab",
        authorName: "JuanG3D",
        authorUrl: "https://sketchfab.com/juang3d",
        licenseName: "CC-BY-4.0",
        licenseUrl: "http://creativecommons.org/licenses/by/4.0/",
    },
];

const Credits = ({ setIsCreditsOpen }) => {
    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Asset credits"
        >
            <div className="w-[clamp(340px,52rem,92vw)] max-h-[80vh] rounded-xl border border-white/15 bg-[#1a1a1a] p-6 text-left flex flex-col">
                <div className="mb-4 flex items-center justify-between gap-4 shrink-0">
                    <h2 className="text-xl">asset credits</h2>
                    <button
                        type="button"
                        onClick={() => setIsCreditsOpen(false)}
                        className="hover:cursor-pointer transition-transform duration-150 ease-out hover:scale-[1.02] active:scale-100 hover:opacity-95 active:opacity-90"
                    >
                        <CloseIcon className="w-6 h-6" />
                    </button>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto app-scroll pr-1 flex flex-col gap-4">
                    {CREDITS.map((credit) => (
                        <div
                            key={credit.id}
                            className="rounded-lg border border-white/10 bg-white/5 p-3"
                        >
                            <p className="text-base font-semibold">{credit.title}</p>
                            <p className="text-sm text-white/80">
                                by{" "}
                                <a
                                    href={credit.authorUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-primary underline"
                                >
                                    {credit.authorName}
                                </a>
                            </p>
                            <p className="mt-1 text-sm">
                                source:{" "}
                                <a
                                    href={credit.sourceUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-primary underline"
                                >
                                    {credit.sourceLabel}
                                </a>
                            </p>
                            <p className="text-sm">
                                license:{" "}
                                <a
                                    href={credit.licenseUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-primary underline"
                                >
                                    {credit.licenseName}
                                </a>
                            </p>
                        </div>
                    ))}
                </div>
            
            </div>
        </div>
    )
}

export default Credits
