import React from "react";
import {
    DataEntryHeader,
    DataEntryRow,
    getDataEntryHeaders,
    getProp,
    snakeCaseToTitle,
} from "../utils";

export function toColumn(
    field: keyof DataEntryRow,
    hidden?: boolean,
    title?: string
): DataEntryHeader {
    return {
        field: field,
        title: title
        ? title
        : snakeCaseToTitle(field).replace(/([iI][dD])/g, txt => txt.toUpperCase()),
        hidden: hidden };
}

export function getColumns(category: "required" | "optional" | "RNASeq"): DataEntryHeader[] {
    return (getProp(getDataEntryHeaders(), category) as Array<keyof DataEntryRow>).map(field =>
        toColumn(field, category !== "required")
    );
}

export interface Option {
    title: string;
    inputValue: string;
    origin?: string;
    disabled?: boolean;
}

export function toOption(str: string | Option, origin?: string, disabled?: boolean): Option {
    if (typeof str === "string")
        return { title: str, inputValue: str, origin: origin, disabled: disabled };
    return { ...str, origin: origin, disabled: disabled };
}

/**
 * Returns the allowed options for the provided
 *
 * @param rows The data currently stored in the table.
 * @param col The column for this cell
 * @param rowIndex The row index of this cell.
 * @param families The result from /api/families
 * @param enums The result from /api/enums
 */
export function getOptions(
    rows: DataEntryRow[],
    col: DataEntryHeader,
    rowIndex: number,
    families: Array<any>,
    enums: any
): Option[] {
    const row = rows[rowIndex];
    const rowOptions = rows
        .filter((val, index) => index !== rowIndex) // not this row
        .map(val => toOption("" + getProp(val, col.field), "Previous rows"));

    const familyCodenames: string[] = families.map(value => value.family_codename);

    switch (col.field) {
        case "family_codename":
            const familyOptions = families.map(value =>
                toOption(value.family_codename, "Existing families")
            );
            return familyOptions.concat(rowOptions);

        case "participant_codename":
            const thisFamily = row.family_codename;
            if (familyCodenames.findIndex(family => family === thisFamily) !== -1) {
                const existingParts = families
                    .filter(family => family.family_codename === thisFamily)
                    .flatMap(family => family.participants)
                    .map(value => toOption(value.participant_codename, "Participants in family"));
                const otherParts = families
                    .filter(family => family.family_codename !== thisFamily)
                    .flatMap(family => family.participants)
                    .map(value => toOption(value.participant_codename, "Other participants"));
                return existingParts.concat(otherParts).concat(rowOptions);
            } else {
                const participants = families.flatMap(family => family.participants);
                const participantOptions = participants.map(value =>
                    toOption(value.participant_codename, "Existing participants")
                );
                return participantOptions.concat(rowOptions);
            }

        case "participant_type":
            if (enums) {
                const participantTypeOptions = (enums.ParticipantType as string[]).map(value =>
                    toOption(value, "Participant Types")
                );
                return participantTypeOptions;
            }
            return rowOptions;

        case "tissue_sample_type":
            if (enums) {
                const tissueTypeOptions = (enums.TissueSampleType as string[]).map(value =>
                    toOption(value, "Tissue Types")
                );
                return tissueTypeOptions;
            }
            return rowOptions;

        case "dataset_type":
            if (enums) {
                const datasetTypeOptions = (enums.DatasetType as string[]).map(value =>
                    toOption(value, "Dataset Types")
                );
                return datasetTypeOptions;
            }
            return rowOptions;

        default:
            return rowOptions;
    }
}
