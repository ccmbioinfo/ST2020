import React, { ReactNode, useEffect, useState } from "react";
import {
    Checkbox,
    IconButton,
    makeStyles,
    TableCell,
    TableCellProps,
    TextField,
    Tooltip,
} from "@material-ui/core";
import { Autocomplete, createFilterOptions } from "@material-ui/lab";
import { Resizable } from "re-resizable";
import FileLinkingComponent from "../../components/FileLinkingComponent";
import { strIsEmpty } from "../../functions";
import { DataEntryHeader, DataEntryRow, Option, UnlinkedFile } from "../../typings";
import { booleanColumns, dateColumns, enumerableColumns, toOption } from "./utils";

const useCellStyles = makeStyles(theme => ({
    textField: {
        width: "125px",
    },
    resizableHeader: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRight: `dotted 2px ${theme.palette.text.disabled}`,
        marginBottom: "5px",
    },
    removePadding: {
        padding: 0,
    },
}));

/**
 * A 'general' data entry cell that returns a table cell with a user control
 * appropriate for the type of value required.
 */
export function DataEntryCell(props: {
    row: DataEntryRow;
    rowIndex: number;
    col: DataEntryHeader;
    getOptions: (rowIndex: number, col: DataEntryHeader) => any[];
    onEdit: (newValue: string | boolean | UnlinkedFile[], autocomplete?: boolean) => void;
    disabled?: boolean;
    required?: boolean;
    onSearch?: (value: string) => void;
    loading?: boolean;
}) {
    if (booleanColumns.includes(props.col.field)) {
        return (
            <CheckboxCell
                value={!!props.row[props.col.field]}
                onEdit={props.onEdit}
                disabled={props.disabled}
            />
        );
    } else if (dateColumns.includes(props.col.field)) {
        return (
            <DateCell
                value={props.row[props.col.field]?.toString()}
                onEdit={props.onEdit}
                disabled={props.disabled}
            />
        );
    } else if (props.col.field === "linked_files") {
        return (
            <TableCell padding="none" align="center">
                <FileLinkingComponent
                    values={props.row[props.col.field] || []}
                    options={props.getOptions(props.rowIndex, props.col)}
                    onEdit={props.onEdit}
                    disabled={props.disabled}
                />
            </TableCell>
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
            required={props.required}
            onSearch={props.onSearch}
            loading={props.loading}
        />
    );
}

/**
 * A cell in the DataEntryTable that the user can type into.
 */
export function AutocompleteCell(
    props: {
        value: Option;
        options: Option[];
        onEdit: (newValue: string, autopopulate?: boolean) => void;
        disabled?: boolean;
        column: DataEntryHeader;
        required?: boolean;
        onSearch?: (value: string) => void;
        loading?: boolean;
    } & TableCellProps
) {
    // We control the inputValue so that we can query with it
    // with this pattern, we have to be careful that search state and selection state stay in sync
    const [search, setSearch] = useState(props.value.inputValue);

    //selected value might change via autopopulate
    useEffect(() => {
        if (!strIsEmpty(props.value.inputValue) && props.value.title !== search) {
            setSearch(props.value.title);
        }
    }, [props.value, search]);

    const onSearch = (value: string) => {
        setSearch(value);
        //a search will reset any selected value
        props.onEdit("");
        //trigger dynamic option load
        if (props.onSearch) props.onSearch(value);
    };

    const isFreeSolo = () => props.column.field === "notes";

    //dummy value to suppress warnings when initializing with empty string search value
    if (props.value.inputValue === "") {
        props.options.push({
            title: "",
            inputValue: "",
            origin: "dummy",
        });
    }

    // Adds user-entered value as option
    // We prefer to show pre-existing options than the "create new" option
    if (
        !enumerableColumns.includes(props.column.field) &&
        search !== "" &&
        !props.options.find(option => option.inputValue === search) &&
        props.column.field !== "notes"
    ) {
        props.options.push({
            title: `Add "${search}"`,
            inputValue: search,
            origin: "Add new...",
        });
    }

    const triggerAutopopulation = ["participant_codename", "family_codename"].includes(
        props.column.field
    );

    const isError = props.required && strIsEmpty(props.value.inputValue);

    return (
        <TableCell>
            <Autocomplete
                loading={props.loading}
                loadingText="Fetching..."
                disabled={props.disabled}
                aria-label={props["aria-label"]}
                freeSolo={isFreeSolo()}
                selectOnFocus
                onBlur={() => {
                    if (!enumerableColumns.includes(props.column.field)) {
                        //update on blur if user isn't required to select an option
                        props.onEdit(search, triggerAutopopulation);
                    } else if (strIsEmpty(props.value.inputValue)) {
                        //if this is an enum col, user might have left a string in the box
                        //if there's no selection, wipe it out
                        setSearch("");
                    }
                }}
                handleHomeEndKeys
                autoHighlight
                inputValue={search}
                onInputChange={(event, searchString, reason) => {
                    if (reason === "clear") {
                        onSearch("");
                    } else if (reason === "input") {
                        onSearch(searchString);
                    }
                }}
                onChange={(event, newValue) => {
                    //value is passed around as an Option, so we need to transform here for typescript
                    const optionValue = toOption(newValue);
                    props.onEdit(toOption(newValue).inputValue, triggerAutopopulation);
                    setSearch(optionValue.title);
                }}
                options={props.options}
                value={props.value}
                renderInput={params => (
                    <TextField
                        {...params}
                        variant="standard"
                        error={isError}
                        helperText={isError && "Field is required."}
                    />
                )}
                groupBy={option => (option.origin ? option.origin : "Unknown")}
                filterOptions={(options, params) =>
                    createFilterOptions<Option>({
                        limit: 25,
                    })(options, params).filter(val => val.inputValue !== props.value.inputValue)
                }
                getOptionDisabled={option => !!option.disabled}
                getOptionLabel={option => option.title}
                getOptionSelected={(option, value) => option.inputValue === value.inputValue}
                renderOption={option => option.title}
            />
        </TableCell>
    );
}

/* A data entry cell for columns which require a boolean value. */
export function CheckboxCell(props: {
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

/* A data entry cell for columns which require a date value. */
export function DateCell(props: {
    value: string | undefined;
    onEdit: (newValue: string) => void;
    disabled?: boolean;
}) {
    const classes = useCellStyles();
    const isError = !props.value || props.value === "";
    return (
        <TableCell>
            <TextField
                className={classes.textField}
                id="date"
                size="small"
                type="date"
                value={props.value}
                error={isError}
                helperText={isError && "Field is required."}
                disabled={props.disabled}
                onChange={e => props.onEdit(e.target.value)}
            />
        </TableCell>
    );
}

/**
 * A cell in the DataEntryTable positioned before all the entry rows, which
 * provides an action button that the user can click.
 */
export function DataEntryActionCell(props: {
    onClick?: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
    icon: ReactNode;
    tooltipTitle: string;
    disabled?: boolean;
}) {
    return (
        <TableCell padding="checkbox">
            <Tooltip title={props.tooltipTitle}>
                <span>
                    <IconButton
                        onClick={props.onClick}
                        disabled={props.disabled}
                        aria-label={props.tooltipTitle}
                    >
                        {props.icon}
                    </IconButton>
                </span>
            </Tooltip>
        </TableCell>
    );
}

/* A header cell in the DataEntryTable. */
export function HeaderCell(props: { header: string }) {
    const classes = useCellStyles();
    return (
        <TableCell className={classes.removePadding}>
            <Resizable
                className={classes.resizableHeader}
                defaultSize={{
                    width: 170,
                    height: 30,
                }}
                minWidth={130}
                maxWidth={1000}
                enable={{
                    top: false,
                    right: true,
                    bottom: false,
                    left: false,
                    topRight: false,
                    bottomRight: false,
                    bottomLeft: false,
                    topLeft: false,
                }}
            >
                {props.header}
            </Resizable>
        </TableCell>
    );
}
