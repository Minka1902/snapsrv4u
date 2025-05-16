function getUniquePropertyNames(properties) {
    return Object.entries(properties)
        .filter(([_, value]) => value?.unique === true)
        .map(([key]) => key);
};

function getFaultyPropertyNames(newObject, existingArray, uniqueKeys) {
    let faultyProps = [];

    for (const existing of existingArray) {
        for (const key of uniqueKeys) {
            if (existing[key] === newObject[key]) {
                faultyProps.indexOf(key) === -1 && faultyProps.push(key);
            }
        }
    }

    return faultyProps;
};

module.exports = { getUniquePropertyNames, getFaultyPropertyNames };