import React, { useState } from "react";
import { TableRow } from "@material-ui/core";
import { Delete, LibraryAdd } from "@material-ui/icons";
import { useFamiliesQuery } from "../../hooks";
import { DataEntryHeader, DataEntryRow, Family, UnlinkedFile } from "../../typings";
import { DataEntryActionCell, DataEntryCell } from "./TableCells";
import { participantColumns } from "./utils";

interface DataEntryTableRowProps {
    row: DataEntryRow;
    rowIndex: number;
    requiredCols: DataEntryHeader[];
    optionalCols: DataEntryHeader[];
    rnaSeqCols: DataEntryHeader[];
    onDelete: () => void;
    onDuplicate: () => void;
    onChange: (
        newValue: string | boolean | UnlinkedFile[],
        rowIndex: number,
        col: DataEntryHeader,
        families: Family[],
        autopopulate?: boolean
    ) => void;
    getOptions: (rowIndex: number, col: DataEntryHeader, families: Family[]) => any[];
}

/**
 * Internal component for handling rows in the body of the DataEntryTable.
 */
export default function DataEntryTableRow(props: DataEntryTableRowProps) {
    const [familySearch, setFamilySearch] = useState("");
    const familiesResult = useFamiliesQuery(familySearch);
    const families = familiesResult.data || [];
    const showRNA = props.row.dataset_type === "RRS";

    function handleChange(
        newValue: string | boolean | UnlinkedFile[],
        col: DataEntryHeader,
        autopopulate?: boolean
    ) {
        return props.onChange(newValue, props.rowIndex, col, families, autopopulate);
    }

    function onSearch(col: DataEntryHeader, value: string) {
        if (col.field === "family_codename") {
            setFamilySearch(value);
        }
    }

    function getOptions(rowIndex: number, col: DataEntryHeader) {
        return props.getOptions(rowIndex, col, families);
    }

    return (
        <TableRow key={props.rowIndex}>
            <DataEntryActionCell
                tooltipTitle="Delete row"
                icon={<Delete />}
                onClick={props.onDelete}
            />
            <DataEntryActionCell
                tooltipTitle="Duplicate row"
                icon={<LibraryAdd />}
                onClick={props.onDuplicate}
            />

            {props.requiredCols.map(col => (
                <DataEntryCell
                    row={props.row}
                    rowIndex={props.rowIndex}
                    col={col}
                    getOptions={getOptions}
                    onEdit={(newValue, autocomplete?: boolean) =>
                        handleChange(newValue, col, autocomplete)
                    }
                    key={col.field}
                    required={!props.row.participantColDisabled} // not required if pre-filled
                    disabled={
                        props.row.participantColDisabled &&
                        (participantColumns as string[]).includes(col.field)
                    }
                    onSearch={search => onSearch(col, search)}
                    loading={col.field === "family_codename" && familiesResult.isLoading}
                />
            ))}
            {props.optionalCols.map(
                col =>
                    !col.hidden && (
                        <DataEntryCell
                            row={props.row}
                            rowIndex={props.rowIndex}
                            col={col}
                            getOptions={getOptions}
                            onEdit={newValue => handleChange(newValue, col)}
                            key={col.field}
                            disabled={
                                props.row.participantColDisabled &&
                                !!participantColumns.find(currCol => currCol === col.field)
                            }
                        />
                    )
            )}

            {showRNA &&
                props.rnaSeqCols.map(col => (
                    <DataEntryCell
                        row={props.row}
                        rowIndex={props.rowIndex}
                        col={col}
                        getOptions={getOptions}
                        onEdit={newValue => handleChange(newValue, col)}
                        key={col.field}
                    />
                ))}
        </TableRow>
    );
}
