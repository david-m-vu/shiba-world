export const isEditableElement = (element) => {
    if (!(element instanceof HTMLElement)) {
        return false;
    }

    if (element.isContentEditable) {
        return true;
    }

    const tagName = element.tagName;
    return tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT";
};