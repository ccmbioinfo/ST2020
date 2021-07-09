import React, { useEffect, useState } from "react";
import {
    Button,
    makeStyles,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
} from "@material-ui/core";
import { Add } from "@material-ui/icons";
import dayjs from "dayjs";
import { createEmptyRows, getDataEntryHeaders, setProp } from "../../functions";
import { useEnumsQuery, useInstitutionsQuery, useUnlinkedFilesQuery } from "../../hooks";
import {
    DataEntryHeader,
    DataEntryRow,
    DataEntryRowOptional,
    Family,
    UnlinkedFile,
} from "../../typings";
import DataEntryTableRow from "./DataEntryTableRow";
import DataEntryToolbar from "./DataEntryToolbar";
import { HeaderCell } from "./TableCells";
import { getOptions as _getOptions, getColumns, objArrayToCSV, participantColumns } from "./utils";

export interface DataEntryTableProps {
    data: DataEntryRow[];
    onChange: (data: DataEntryRow[]) => void;
    allGroups: string[]; // this user's permission groups
    groups: string[]; // selected groups to submit as
    setGroups: (selectedGroups: string[]) => void;
}

const useTableStyles = makeStyles(theme => ({
    buttonCell: {
        padding: 0,
    },
    newRowButton: {
        width: "100%",
    },
}));

const fallbackColumns = ["notes", "sex", "linked_files", "sequencing_date"];

function getEnvColumns(): Array<keyof DataEntryRowOptional> {
    const envCols = process.env.REACT_APP_DEFAULT_OPTIONAL_COLUMNS;
    if (envCols !== undefined) {
        const validFields = getDataEntryHeaders().optional;
        const envFields = envCols.split(",");
        const usableFields =
            process.env.NODE_ENV === "development"
                ? envFields.filter(field => !!validFields.find(valid => valid === field))
                : envFields;
        return usableFields as Array<keyof DataEntryRowOptional>;
    } else {
        return [];
    }
}

function getDefaultColumns(fallbackColumns: string[]) {
    const storedDefaults = window.localStorage.getItem("data-entry-default-columns");
    let tempCols = fallbackColumns;
    const envCols = getEnvColumns();

    if (storedDefaults !== null) {
        // User already has stored preferences
        tempCols = JSON.parse(storedDefaults);
    } else if (envCols.length > 0) {
        // No preferences, use .env
        tempCols = envCols;
    } else {
        // No .env, use fallback columns
        window.localStorage.setItem("data-entry-default-columns", JSON.stringify(tempCols));
    }
    return tempCols;
}

function findParticipant(newValue: string, column: string, row: DataEntryRow, families: Family[]) {
    let participantCodename: string;
    let familyCodename: string;
    if (column === "participant_codename" && row.family_codename !== "") {
        familyCodename = row.family_codename;
        participantCodename = newValue;
    } else if (column === "family_codename" && row.participant_codename !== "") {
        familyCodename = newValue;
        participantCodename = row.participant_codename;
    }
    const family = families.find(fam => fam.family_codename === familyCodename);
    return family
        ? family.participants.find(
              currParticipant => currParticipant.participant_codename === participantCodename
          )
        : undefined;
}

export default function DataEntryTable(props: DataEntryTableProps) {
    const classes = useTableStyles();

    const columns = getColumns("required");
    const RNASeqCols = getColumns("RNASeq");

    function getOptionalHeaders() {
        const defaults = getDefaultColumns(fallbackColumns);
        return getColumns("optional").map(header => ({
            ...header,
            hidden: !defaults.includes(header.field),
        }));
    }

    const [optionals, setOptionals] = useState<DataEntryHeader[]>(getOptionalHeaders());

    const filesQuery = useUnlinkedFilesQuery();
    const [files, setFiles] = useState<UnlinkedFile[]>([]);
    const institutionResult = useInstitutionsQuery();
    const institutions = institutionResult.data || [];
    const { data: enums } = useEnumsQuery();
    const [showRNA, setShowRNA] = useState<boolean>(false);

    useEffect(() => {
        if (filesQuery.isSuccess) setFiles(filesQuery.data);
    }, [filesQuery]);

    function onEdit(
        newValue: string | boolean | UnlinkedFile[],
        rowIndex: number,
        col: DataEntryHeader,
        families: Family[],
        autopopulate?: boolean
    ) {
        if (col.field === "dataset_type" && newValue === "RRS") {
            setShowRNA(true);
        }
        const newRows = props.data.map((value, index) => {
            if (autopopulate && index === rowIndex) {
                // autopopulate row
                // pre-existing rows are disabled, even if the values are wrong
                const participant = findParticipant(newValue as string, col.field, value, families);
                if (participant) {
                    // pre-existing participant
                    return setProp(
                        participantColumns.reduce(
                            (row, currCol) => setProp(row, currCol, participant[currCol]), // reducer
                            setProp({ ...value }, "participantColDisabled", true) // init
                        ),
                        col.field,
                        newValue
                    );
                } else {
                    // No participant found
                    return setProp(
                        setProp({ ...value }, "participantColDisabled", false),
                        col.field,
                        newValue
                    );
                }
            } else if (index === rowIndex) {
                return setProp({ ...value }, col.field, newValue);
            } else {
                return value;
            }
        });
        props.onChange(newRows);
    }

    // Return the options for a given cell based on row, column
    function getOptions(rowIndex: number, col: DataEntryHeader, families: Family[]) {
        return _getOptions(props.data, col, rowIndex, families, enums, files, institutions);
    }

    function toggleHideColumn(colField: keyof DataEntryRow) {
        const newOptionals = optionals.map(value => {
            if (value.field === colField) return { ...value, hidden: !value.hidden };
            return value;
        });
        setOptionals(newOptionals);
        window.localStorage.setItem(
            "data-entry-default-columns",
            JSON.stringify(newOptionals.filter(value => !value.hidden).map(value => value.field))
        );
    }

    function downloadTemplateCSV() {
        const requiredHeaders = columns.map(c => c.field);
        const optionalHeaders = optionals.filter(c => !c.hidden).map(c => c.field);
        const rnaseqHeaders = showRNA ? RNASeqCols.map(c => c.field) : [];
        const headers = requiredHeaders.concat(optionalHeaders).concat(rnaseqHeaders);

        const csv = objArrayToCSV(props.data, headers, true);
        let hiddenElement = document.createElement("a");
        hiddenElement.href = "data:text/csv;charset=utf-8," + encodeURI(csv);
        hiddenElement.target = "_blank";
        const now = dayjs().format("YYYY-MM-DDThh-mm-ssA");
        hiddenElement.download = `AddDatasets-${now}.csv`;
        hiddenElement.click();
        hiddenElement.remove();
    }

    return (
        <Paper>
            <DataEntryToolbar
                columns={optionals}
                handleColumnAction={toggleHideColumn}
                handleResetAction={() => {
                    window.localStorage.removeItem("data-entry-default-columns");
                    setOptionals(getOptionalHeaders());
                }}
                handleCSVTemplateAction={downloadTemplateCSV}
                allGroups={props.allGroups}
                groups={props.groups}
                setGroups={props.setGroups}
            />
            <TableContainer>
                <Table>
                    <caption>* - Required | ** - Required only if Dataset Type is RRS</caption>
                    <TableHead>
                        <TableRow>
                            <TableCell padding="checkbox" aria-hidden={true} />
                            <TableCell padding="checkbox" aria-hidden={true} />
                            {columns.map(cell => (
                                <HeaderCell key={cell.field} header={cell.title + "*"} />
                            ))}

                            {optionals.map(
                                cell =>
                                    !cell.hidden && (
                                        <HeaderCell key={cell.field} header={cell.title} />
                                    )
                            )}

                            {showRNA &&
                                RNASeqCols.map(cell => (
                                    <HeaderCell key={cell.field} header={cell.title + "**"} />
                                ))}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {props.data.map((row, rowIndex) => (
                            <DataEntryTableRow
                                row={row}
                                rowIndex={rowIndex}
                                key={rowIndex}
                                requiredCols={columns}
                                optionalCols={optionals}
                                rnaSeqCols={RNASeqCols}
                                getOptions={getOptions}
                                onChange={onEdit}
                                onDuplicate={() =>
                                    props.onChange(
                                        props.data.flatMap((value, index) =>
                                            index === rowIndex
                                                ? [
                                                      value,
                                                      {
                                                          ...value,
                                                          linked_files: undefined,
                                                      },
                                                  ]
                                                : value
                                        )
                                    )
                                }
                                onDelete={() =>
                                    props.onChange(
                                        props.data.filter((value, index) => index !== rowIndex)
                                    )
                                }
                            />
                        ))}
                        <TableRow>
                            <TableCell className={classes.buttonCell} colSpan={100}>
                                <Button
                                    className={classes.newRowButton}
                                    variant="contained"
                                    color="default"
                                    disableElevation
                                    disableRipple
                                    startIcon={<Add />}
                                    onClick={() =>
                                        props.onChange(props.data.concat(createEmptyRows(1)))
                                    }
                                >
                                    Add new row
                                </Button>
                            </TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </TableContainer>
        </Paper>
    );
}
