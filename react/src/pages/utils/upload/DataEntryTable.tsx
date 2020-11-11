import React, { ReactNode, useEffect, useState } from "react";
import {
    Box,
    Checkbox,
    IconButton,
    makeStyles,
    Menu,
    MenuItem,
    Paper,
    Switch,
    Table,
    TableBody,
    TableCell,
    TableCellProps,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Toolbar,
    Tooltip,
    Typography,
} from "@material-ui/core";
import { Autocomplete, createFilterOptions } from "@material-ui/lab";
import { AddBoxOutlined, CloudUpload, Delete, LibraryAdd, ViewColumn } from "@material-ui/icons";
import { DataEntryHeader, DataEntryRow } from "../typings";
import {
    Option,
    toOption,
    getOptions as _getOptions,
    getColumns,
    booleanColumns,
    enumerableColumns,
} from "./UploadUtils";
import UploadDialog from "./UploadDialog";
import { setProp } from "../functions";

export interface DataEntryTableProps {
    data?: DataEntryRow[];
}

function createEmptyRows(amount?: number): DataEntryRow[] {
    if (!amount || amount < 1) amount = 1;

    var arr = [];
    for (let i = 0; i < amount; i++) {
        arr.push({
            family_codename: "",
            participant_codename: "",
            participant_type: "",
            tissue_sample_type: "",
            dataset_type: "",
        });
    }
    return arr;
}

const useTableStyles = makeStyles(theme => ({
    requiredCell: {
        minWidth: "16em",
    },
    optionalCell: {
        minWidth: "8em",
    },
}));

const defaultOptionals = ["notes", "sex"];

export default function DataEntryTable(props: DataEntryTableProps) {
    const classes = useTableStyles();

    const columns = getColumns("required");
    const RNASeqCols = getColumns("RNASeq");

    const [optionals, setOptionals] = useState<DataEntryHeader[]>(
        getColumns("optional").map(header => {
            return { ...header, hidden: !defaultOptionals.includes(header.field) };
        })
    );

    const [rows, setRows] = useState<DataEntryRow[]>(props.data ? props.data : createEmptyRows(3));
    const [families, setFamilies] = useState<Array<any>>([]);
    const [enums, setEnums] = useState<any>();

    const [showRNA, setShowRNA] = useState<boolean>(false);

    useEffect(() => {
        fetch("/api/families")
            .then(response => response.json())
            .then(data => {
                setFamilies(data);
            })
            .catch(error => {
                console.error(error);
            });

        fetch("/api/enums")
            .then(response => response.json())
            .then(data => {
                setEnums(data);
            })
            .catch(error => {
                console.error(error);
            });
    }, []);

    function onEdit(newValue: string | boolean, rowIndex: number, col: DataEntryHeader) {
        if (col.field === "dataset_type" && newValue === "RRS") {
            setShowRNA(true);
        }
        setRows(
            rows.map((value, index) => {
                if (index === rowIndex) {
                    return setProp({ ...value }, col.field, newValue);
                } else {
                    return value;
                }
            })
        );
    }

    // Return the options for a given cell based on row, column
    function getOptions(rowIndex: number, col: DataEntryHeader): Option[] {
        return _getOptions(rows, col, rowIndex, families, enums);
    }

    function toggleHideColumn(colField: keyof DataEntryRow) {
        setOptionals(
            optionals.map(value => {
                if (value.field === colField) return { ...value, hidden: !value.hidden };
                return value;
            })
        );
    }

    return (
        <Paper>
            <DataEntryToolbar
                handleAddRow={event => {
                    setRows(rows.concat(createEmptyRows(1)));
                }}
                columns={optionals}
                handleColumnAction={toggleHideColumn}
            />
            <TableContainer>
                <Table>
                    <caption>{"* - Required | ** - Required only if Dataset Type is RRS"}</caption>
                    <TableHead>
                        <TableRow>
                            <TableCell padding="checkbox" aria-hidden={true} />
                            <TableCell padding="checkbox" aria-hidden={true} />
                            {columns.map((cell, index) => (
                                <TableCell className={classes.requiredCell}>
                                    {cell.title + "*"}
                                </TableCell>
                            ))}

                            {optionals.map((cell, index) => (
                                <>
                                    {!cell.hidden && (
                                        <TableCell className={classes.optionalCell}>
                                            {cell.title}
                                        </TableCell>
                                    )}
                                </>
                            ))}

                            {showRNA &&
                                RNASeqCols.map(cell => (
                                    <>
                                        <TableCell className={classes.optionalCell}>
                                            {cell.title + "**"}
                                        </TableCell>
                                    </>
                                ))}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {rows.map((row, rowIndex) => (
                            <TableRow>
                                <DataEntryActionCell
                                    tooltipTitle="Delete row"
                                    icon={<Delete />}
                                    onClick={e => {
                                        setRows(rows.filter((value, index) => index !== rowIndex));
                                    }}
                                    disabled={rows.length === 1}
                                />
                                <DataEntryActionCell
                                    tooltipTitle="Duplicate row"
                                    icon={<LibraryAdd />}
                                    onClick={e => {
                                        setRows(
                                            rows.flatMap((value, index) =>
                                                index === rowIndex
                                                    ? [value, { ...value } as DataEntryRow]
                                                    : value
                                            )
                                        );
                                    }}
                                />

                                {columns.map(col => (
                                    <DataEntryCell
                                        row={row}
                                        rowIndex={rowIndex}
                                        col={col}
                                        getOptions={getOptions}
                                        onEdit={newValue => onEdit(newValue, rowIndex, col)}
                                    />
                                ))}

                                {optionals.map(col => (
                                    <>
                                        {!col.hidden && (
                                            <DataEntryCell
                                                row={row}
                                                rowIndex={rowIndex}
                                                col={col}
                                                getOptions={getOptions}
                                                onEdit={newValue => onEdit(newValue, rowIndex, col)}
                                            />
                                        )}
                                    </>
                                ))}

                                {showRNA &&
                                    RNASeqCols.map(col => (
                                        <>
                                            {
                                                <DataEntryCell
                                                    row={row}
                                                    rowIndex={rowIndex}
                                                    col={col}
                                                    getOptions={getOptions}
                                                    onEdit={newValue =>
                                                        onEdit(newValue, rowIndex, col)
                                                    }
                                                    disabled={row.dataset_type !== "RRS"}
                                                />
                                            }
                                        </>
                                    ))}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        </Paper>
    );
}

/**
 * A 'general' data entry cell that returns a table cell with a user control
 * appropriate for the type of value required.
 */
function DataEntryCell(props: {
    row: DataEntryRow;
    rowIndex: number;
    col: DataEntryHeader;
    getOptions: (rowIndex: number, col: DataEntryHeader) => Option[];
    onEdit: (newValue: string | boolean) => void;
    disabled?: boolean;
}) {
    if (booleanColumns.includes(props.col.field)) {
        return (
            <CheckboxCell
                value={!!props.row[props.col.field]}
                onEdit={props.onEdit}
                disabled={props.disabled}
            />
        );
    }
    return (
        <AutocompleteCell
            value={toOption(props.row[props.col.field])}
            options={props.getOptions(props.rowIndex, props.col)}
            onEdit={props.onEdit}
            disabled={props.disabled}
            column={props.col}
            aria-label={`enter ${props.col.title} row ${props.rowIndex}`}
        />
    );
}

const filter = createFilterOptions<Option>({
    limit: 25,
});

/**
 * A cell in the DataEntryTable that the user can type into.
 */
function AutocompleteCell(
    props: {
        value: Option;
        options: Option[];
        onEdit: (newValue: string) => void;
        disabled?: boolean;
        column: DataEntryHeader;
    } & TableCellProps
) {
    const onEdit = (newValue: Option) => {
        props.onEdit(newValue.inputValue);
    };

    // Remove 'this' input value from the list of options
    const options = props.options.filter(
        (val, index, arr) =>
            arr.findIndex((opt, i) => opt.inputValue === val.inputValue) === index &&
            val.inputValue !== props.value.inputValue
    );

    return (
        <TableCell>
            <Autocomplete
                disabled={props.disabled}
                aria-label={props["aria-label"]}
                selectOnFocus
                clearOnBlur
                handleHomeEndKeys
                autoHighlight
                onChange={(event, newValue) => {
                    if (newValue) {
                        onEdit(toOption(newValue));
                    } else {
                        onEdit(toOption(""));
                    }
                }}
                options={options}
                value={props.value}
                renderInput={params => <TextField {...params} variant="standard" />}
                groupBy={option => (option.origin ? option.origin : "Unknown")}
                filterOptions={(options, params) => {
                    const filtered = filter(options, params);

                    // Adds user-entered value as option
                    // We prefer to show pre-existing options than the "create new" option
                    if (
                        !enumerableColumns.includes(props.column.field) &&
                        params.inputValue !== "" &&
                        !filtered.find(option => option.inputValue === params.inputValue)
                    ) {
                        filtered.push({
                            title: `Add "${params.inputValue}"`,
                            inputValue: params.inputValue,
                            origin: "Add new...",
                        });
                    }

                    return filtered;
                }}
                getOptionDisabled={option => !!option.disabled}
                getOptionLabel={option => option.inputValue}
                renderOption={option => option.title}
            />
        </TableCell>
    );
}

/**
 * A data entry cell for columns which require a boolean value.
 */
function CheckboxCell(props: {
    value: boolean;
    onEdit: (newValue: boolean) => void;
    disabled?: boolean;
}) {
    return (
        <TableCell padding="checkbox">
            <Checkbox
                checked={props.value}
                onChange={event => props.onEdit(event.target.checked)}
                disabled={props.disabled}
            />
        </TableCell>
    );
}

/**
 * A cell in the DataEntryTable positioned before all the entry rows, which
 * provides an action button that the user can click.
 */
function DataEntryActionCell(props: {
    onClick?: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
    icon: ReactNode;
    tooltipTitle: string;
    disabled?: boolean;
}) {
    return (
        <TableCell padding="checkbox">
            <Tooltip title={props.tooltipTitle}>
                <IconButton
                    onClick={props.onClick}
                    disabled={props.disabled}
                    aria-label={props.tooltipTitle}
                >
                    {props.icon}
                </IconButton>
            </Tooltip>
        </TableCell>
    );
}

const useToolbarStyles = makeStyles(theme => ({
    toolbar: {
        paddingRight: theme.spacing(1),
        paddingLeft: theme.spacing(2),
    },
}));

/**
 * The toolbar for the DataEntryTable, which displays the title and other action
 * buttons that do not depend on specific rows.
 */
function DataEntryToolbar(props: {
    handleAddRow: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
    handleColumnAction: (field: keyof DataEntryRow) => void;
    columns: DataEntryHeader[];
}) {
    const classes = useToolbarStyles();
    const [openUpload, setOpenUpload] = useState(false);

    return (
        <>
            <Toolbar className={classes.toolbar}>
                <Box display="flex" flexGrow={1}>
                    <Typography variant="h6">Enter Metadata</Typography>
                </Box>
                <Tooltip title="Upload CSV">
                    <IconButton onClick={() => setOpenUpload(true)}>
                        <CloudUpload />
                    </IconButton>
                </Tooltip>
                <Tooltip title="Add empty row">
                    <IconButton onClick={props.handleAddRow} edge="end">
                        <AddBoxOutlined />
                    </IconButton>
                </Tooltip>
                <DataEntryColumnMenuAction
                    columns={props.columns}
                    onClick={props.handleColumnAction}
                />
            </Toolbar>
            <UploadDialog open={openUpload} onClose={() => setOpenUpload(false)} />
        </>
    );
}

/**
 * A special action button which opens a menu for showing / hiding
 * optional columns.
 */
function DataEntryColumnMenuAction(props: {
    columns: DataEntryHeader[];
    onClick: (field: keyof DataEntryRow) => void;
}) {
    const [anchor, setAnchor] = useState<null | HTMLElement>(null);

    return (
        <>
            <Tooltip title="Show/Hide columns">
                <IconButton
                    onClick={event => {
                        setAnchor(event.currentTarget);
                    }}
                >
                    <ViewColumn />
                </IconButton>
            </Tooltip>
            <Menu
                anchorEl={anchor}
                open={Boolean(anchor)}
                keepMounted
                onClose={() => setAnchor(null)}
            >
                {props.columns.map(column => (
                    <MenuItem onClick={() => props.onClick(column.field)}>
                        <Box display="flex" flexGrow={1}>
                            {column.title}
                        </Box>
                        <Switch edge="end" checked={!column.hidden} />
                    </MenuItem>
                ))}
            </Menu>
        </>
    );
}
