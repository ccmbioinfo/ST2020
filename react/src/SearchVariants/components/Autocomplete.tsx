import React, { useMemo, useState } from "react";
import {
    Button,
    CircularProgress,
    Divider,
    InputAdornment,
    makeStyles,
    Menu,
    MenuItem,
    OutlinedInput,
    useTheme,
} from "@material-ui/core";
import { ArrowDropDown, Check, Search } from "@material-ui/icons";
import { Autocomplete } from "@material-ui/lab";
import { snakeCaseToTitle } from "../../functions";
import { useGenesQuery } from "../../hooks/genes";
import { GeneAlias } from "../../typings";

type SearchCategory = "gene" | "region" | "variant_position" | "rsid";
const searchCategoryMap: Map<SearchCategory, string> = new Map([
    ["gene", "Gene"],
    ["region", "Region"],
    ["variant_position", "Variant Position"],
    ["rsid", "refSNP ID"],
]);

interface GeneAutocompleteProps {
    fullWidth?: boolean;
    onSearch?: () => void;
    onSelect: (result: GeneAlias) => void;
}

interface SearchCategorySelectProps {
    value: SearchCategory;
    onSelect: (value: SearchCategory) => void;
}

const useSelectStyles = makeStyles(theme => ({
    check: {
        marginLeft: theme.spacing(2),
    },
    divider: {
        margin: theme.spacing(0, 1),
    },
}));

function SearchCategorySelect(props: SearchCategorySelectProps) {
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const classes = useSelectStyles();

    return (
        <>
            <Button onClick={event => setAnchorEl(event.currentTarget)}>
                {snakeCaseToTitle(props.value)}
                <ArrowDropDown />
            </Button>
            <Divider className={classes.divider} orientation="vertical" flexItem />
            <Menu
                anchorOrigin={{ horizontal: "left", vertical: "bottom" }}
                transformOrigin={{ horizontal: "left", vertical: "top" }}
                anchorEl={anchorEl}
                keepMounted
                open={!!anchorEl}
                onClose={() => setAnchorEl(null)}
                variant="menu"
                getContentAnchorEl={null}
            >
                {Array.from(searchCategoryMap, ([category, title]) => (
                    <MenuItem
                        key={category}
                        onClick={() => props.onSelect(category)}
                        selected={props.value === category}
                    >
                        {title}
                        <div style={{ flex: 1 }} />
                        <Check
                            className={classes.check}
                            style={{ visibility: props.value === category ? "inherit" : "hidden" }}
                        />
                    </MenuItem>
                ))}
            </Menu>
        </>
    );
}

const useStyles = makeStyles(theme => ({
    adornment: {
        margin: theme.spacing(0, 1),
    },
}));

const GeneAutocomplete: React.FC<GeneAutocompleteProps> = ({ fullWidth, onSearch, onSelect }) => {
    const [search, setSearch] = useState<string>("");
    const [selectedValue, setSelectedValue] = useState<GeneAlias>();
    const [searchCategory, setSearchCategory] = useState<SearchCategory>("gene");
    const classes = useStyles();

    const placeholderText = useMemo(() => {
        switch (searchCategory) {
            case "gene":
                return "Search by Gene Name (eg. APOE, VEGFA)";
            case "region":
                return "Search by Region";
            case "variant_position":
                return "Search by Variant Position";
            case "rsid":
                return "Search by refSNP ID";
            default:
                console.error("Unexpected search category");
                return "";
        }
    }, [searchCategory]);

    // TODO: add searchCategory to params once backend is updated to support other search categories
    const { data: results, isFetching } = useGenesQuery(
        {
            search,
        },
        search.length > 2
    );

    const theme = useTheme();

    return (
        <Autocomplete
            disableClearable
            forcePopupIcon={false}
            autoComplete
            clearOnEscape
            fullWidth={fullWidth}
            getOptionSelected={(option, value) => option.ensembl_id === value.ensembl_id}
            getOptionLabel={option => option.name || ""}
            includeInputInList={true}
            inputValue={search}
            loading={isFetching}
            noOptionsText="No Results"
            options={results?.data.filter(d => d.name) || []}
            onInputChange={(event, newInputValue, reason) => {
                if (reason === "reset") {
                    setSearch("");
                } else if (reason === "input") {
                    setSearch(newInputValue);
                    if (onSearch) {
                        onSearch();
                    }
                }
            }}
            onChange={(event, selectedValue, reason) => {
                if (search && reason !== "clear" && selectedValue) {
                    onSelect(selectedValue);
                    //persisting selected value will lead to option mismatch warnings
                    setSelectedValue(undefined);
                }
            }}
            renderInput={params => {
                const { InputLabelProps, InputProps, ...rest } = params;
                return (
                    <OutlinedInput
                        placeholder={placeholderText}
                        {...rest}
                        {...InputProps}
                        startAdornment={
                            process.env.NODE_ENV === "development" && (
                                // TODO: Remove dev-only rendering when endpoint is updated to accept search category
                                <SearchCategorySelect
                                    value={searchCategory}
                                    onSelect={setSearchCategory}
                                />
                            )
                        }
                        endAdornment={
                            <InputAdornment position="end">
                                <CircularProgress
                                    className={classes.adornment}
                                    size={16}
                                    style={{ visibility: isFetching ? "inherit" : "hidden" }}
                                />
                                <Search
                                    className={classes.adornment}
                                    fontSize="small"
                                    htmlColor={theme.palette.grey[600]}
                                />
                            </InputAdornment>
                        }
                    />
                );
            }}
            //we have to control component in order to *prevent* selection persistence
            value={selectedValue || undefined}
        />
    );
};

export default GeneAutocomplete;
